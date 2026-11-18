"""Baseline PCGrimAge acceleration x treatment on public randomized arms in TranslAGE.

Life-extension open question 8. Data: TranslAGE harmonized clock files
(https://files.dborr.us/<dataset>/DNAmAGE<dataset>_Resid.Rdata, dated 10 Mar 2026,
linked from https://www.translage.io/data/datatables/dataset_metadata.csv).
Usage: python translage-baseline-interaction.py <folder with the .Rdata files>
Needs: pandas, numpy, statsmodels, rdata.

Rule copied from COSMOS (Li et al., Nature Medicine 2026): accelerated = baseline
PCGrimAge residual on chronological age above 0 (residual taken within each trial's
pooled baseline). Outcome = clock change per year. Model per comparison:
  change_per_year ~ arm * accelerated + age + female   (HC3 errors)
plus a continuous version with the residual in place of the split.
"""
import sys, os, numpy as np, pandas as pd, rdata, statsmodels.formula.api as smf
from rdata.conversion import _conversion as C

_orig = C.dataframe_constructor
def _df(obj, attrs):
    obj = {k: (np.asarray(v).reshape(-1) if getattr(v, "ndim", 1) == 2 and v.shape[1] == 1 else v) for k, v in obj.items()}
    return _orig(obj, attrs)
CLASS_MAP = dict(rdata.conversion.DEFAULT_CLASS_MAP); CLASS_MAP["data.frame"] = _df

def load(folder, name, arm):
    d = list(rdata.conversion.convert(rdata.parser.parse_file(os.path.join(folder, name + ".Rdata")), CLASS_MAP, default_encoding="utf8").values())[0]
    d = pd.DataFrame({c: d[c] for c in ["cSUBJECTID", "cAGE", "cFEMALE", "cGROUP", "cTIME"] + CLOCKS})
    if arm is None:  # GSE74548 carries its own placebo label
        d["arm"] = (d["cGROUP"] == "Subject").astype(int)
    else:
        d["arm"] = arm
    d["sid"] = name + ":" + d["cSUBJECTID"].astype(str)
    return d

CLOCKS = ["PCGrimAge", "PCPhenoAge", "DunedinPACE", "GrimAgeV2"]
COMPARISONS = [
    # label, [(file, arm or None)], role
    ("B12+folate vs placebo (GSE74548, 2 y)", [("GSE74548", None)], "placebo"),
    ("Mediterranean diets vs healthy-guidelines control (DIRECT-PLUS E-MTAB-12527, 18 mo)",
     [("E-MTAB-12527_GreenMED", 1), ("E-MTAB-12527_MED", 1), ("E-MTAB-12527_HDG", 0)], "active control"),
    ("Low-carb vs low-fat (CENTRAL E-MTAB-8956, 18 mo)", [("E-MTAB-8956_LC", 1), ("E-MTAB-8956_LF", 0)], "head to head"),
]

def wide(d):
    d = d.sort_values("cTIME")
    base = d.groupby("sid").first(); last = d.groupby("sid").last()
    keep = last["cTIME"] > base["cTIME"]
    base, last = base[keep], last[keep]
    yrs = (last["cTIME"] - base["cTIME"]) / 365.25
    w = pd.DataFrame({"arm": base["arm"], "age": base["cAGE"].astype(float), "female": base["cFEMALE"].astype(float)})
    for c in CLOCKS:
        w["b_" + c] = base[c].astype(float)
        w["d_" + c] = (last[c].astype(float) - base[c].astype(float)) / yrs
    res = smf.ols("b_PCGrimAge ~ age", w).fit().resid
    w["resid"] = res; w["accel"] = (res > 0).astype(int)
    return w

def pool(est, se):
    est, se = np.asarray(est), np.asarray(se); w = 1 / se**2
    fe = (w * est).sum() / w.sum(); q = (w * (est - fe) ** 2).sum(); k = len(est)
    tau2 = max(0.0, (q - (k - 1)) / (w.sum() - (w**2).sum() / w.sum())) if k > 1 else 0.0
    wr = 1 / (se**2 + tau2); re = (wr * est).sum() / wr.sum(); sre = (1 / wr.sum()) ** 0.5
    return re, sre, tau2

def main(folder):
    rows = []
    for label, files, role in COMPARISONS:
        w = wide(pd.concat([load(folder, f, a) for f, a in files]))
        for c in CLOCKS:
            for form, term in (("arm * accel", "arm:accel"), ("arm * resid", "arm:resid")):
                m = smf.ols(f"d_{c} ~ {form} + age + female", w).fit(cov_type="HC3")
                sub = {g: m.params["arm"] + (m.params[term] if g else 0) for g in (0, 1)} if term == "arm:accel" else {}
                rows.append(dict(comparison=label, role=role, clock=c, model=form, n=len(w),
                                 n_treat=int(w.arm.sum()), n_accel=int(w.accel.sum()),
                                 interaction=m.params[term], se=m.bse[term], p=m.pvalues[term],
                                 ci_lo=m.conf_int().loc[term, 0], ci_hi=m.conf_int().loc[term, 1],
                                 effect_not_accel=sub.get(0, np.nan), effect_accel=sub.get(1, np.nan)))
    out = pd.DataFrame(rows)
    pooled = []
    for c in CLOCKS:
        for form in ("arm * accel", "arm * resid"):
            s = out[(out.clock == c) & (out.model == form) & (out.role != "head to head")]
            re, sre, tau2 = pool(s.interaction, s.se)
            pooled.append(dict(comparison="POOLED controlled (random effects)", role="pooled", clock=c, model=form,
                               n=int(s.n.sum()), interaction=re, se=sre, ci_lo=re - 1.96 * sre, ci_hi=re + 1.96 * sre,
                               p=float(2 * (1 - __import__("scipy.stats").stats.norm.cdf(abs(re / sre)))), tau2=tau2))
    out = pd.concat([out, pd.DataFrame(pooled)], ignore_index=True)
    dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), "translage-baseline-interaction.csv")
    out.round(4).to_csv(dst, index=False)
    pd.set_option("display.width", 250)
    print(out[["comparison", "clock", "model", "n", "n_accel", "interaction", "ci_lo", "ci_hi", "p", "effect_not_accel", "effect_accel"]].round(3).to_string())

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
