const STAGE_KINDS = ['2d', '3d'];

function match(text) {
  if (!text) return false;
  return /(what is|tell me about) zorbleflux/i.test(text) || /zorbleflux throttle/i.test(text);
}

async function run({ text }) {
  const t = text || '';
  if (/(what is|tell me about) zorbleflux/i.test(t)) {
    return {
      card: {
        title: 'Zorbleflux Throttle',
        content: 'Zorbleflux is a core mechanic of the Verse stage that prevents high-frequency input overload by dampening burst events across render updates.'
      }
    };
  }

  const matches = t.match(/zorbleflux throttle\s+(\d+)/i);
  const ms = matches ? parseInt(matches[1], 10) : 500;

  return {
    card: {
      title: 'Zorbleflux Throttle Applied',
      content: `Throttled stage updates to ${ms}ms.`
    }
  };
}

export default {
  stageKinds: STAGE_KINDS,
  match,
  run
};
