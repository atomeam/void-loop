# Verse trading bot

A small program that runs one daily strategy on your own exchange account, from your own computer.
The backtests are at https://a-to-mind.com/trading-bots/ and use this same `strategy.js`.

**Verse never sees your API key, never holds your money and never places a trade.** This program does, only where you run it, only with the key you give it.

**Risk:** past results do not predict future results. These strategies have long losing stretches, and you can lose money. Start in paper mode, then with a budget you can afford to lose. This is software, not financial advice.

## What it does

- Once a day, after the daily candle closes (00:00 UTC), it reads the closed daily candles for your pair and asks the strategy: hold the coin, or hold cash?
- If the answer changed, it places one market order: a buy of at most `budget` (in the quote currency), or a sell of the coins it bought.
- Spot only, long or cash. No leverage, no shorting, no withdrawals. It only sells coins it bought itself (kept in `state.json`), never coins you already held.

## Setup (about 10 minutes)

1. Install Node.js 18 or newer (https://nodejs.org).
2. Get the files into a new folder:

   ```
   mkdir verse-bot && cd verse-bot
   curl -fsSLO "https://a-to-mind.com/trading-bots/kit/{bot.mjs,strategy.js,arb-scan.mjs,arb.js,arb.example.json,package.json,config.example.json,README.md,LICENSE}"
   npm install
   cp config.example.json config.json
   ```

3. Edit `config.json`:
   - `bot`: `trend-50-200`, `breakout-20-10` or `dip-rsi2`
   - `exchange`: the ccxt id of your exchange, such as `kraken`, `coinbase`, `binanceus`, `kucoin` or `bitstamp`
   - `symbol`: the pair as your exchange lists it, such as `BTC/USD` or `ETH/USDT`
   - `budget`: the most the bot may ever spend on one buy, in the quote currency
   - `params`: leave `{}` for the defaults the backtests use

4. Paper mode first (no key needed, nothing is traded):

   ```
   node bot.mjs
   ```

   It prints today's decision and keeps a pretend balance in `paper.json`. Run it daily for a while, or `node bot.mjs --loop`.

5. Live, when you are ready:
   - In your exchange's API settings, make a key with **trade permission only**. Never give it withdrawal permission. Restrict it to your IP address if the exchange offers that.
   - Put the key in the environment, never in a file you share:

     ```
     export EXCHANGE_API_KEY=...
     export EXCHANGE_API_SECRET=...
     export VERSE_BOT_LIVE=yes
     node bot.mjs --live --loop
     ```

     (Some exchanges also need `EXCHANGE_API_PASSWORD`, the key's passphrase.)
   - Keep it running on a computer that stays on, or run `node bot.mjs --live` once a day from cron a few minutes after 00:00 UTC:

     ```
     5 0 * * * cd /path/to/verse-bot && VERSE_BOT_LIVE=yes EXCHANGE_API_KEY=... EXCHANGE_API_SECRET=... node bot.mjs --live >> bot.log 2>&1
     ```

## Arbitrage scanner

`arb-scan.mjs` reads the order books of the exchanges in `arb.example.json` (copy it to `arb.json` to change it) and prints every buy-here-sell-there pair for your size, after both taker fees and your transfer cost. Public data only, no key. It never places an order.

```
node arb-scan.mjs              # one scan
node arb-scan.mjs --every 30   # every 30 seconds
```

Set `fees` to your own taker fee on each exchange, and `transferUsd` to what moving the coin costs you (0 if you already hold both sides). A gap is not money in hand: prices move in milliseconds and faster bots close real gaps first.

## Files

- `bot.mjs`: the runner (paper or live, once or in a loop)
- `strategy.js`: the strategies and the backtest, the same file the Verse pages run
- `arb-scan.mjs`, `arb.js`, `arb.example.json`: the arbitrage scanner (read only)
- `state.json` / `paper.json`: written by the bot; what it holds and what it did
- `LICENSE`: MIT

To stop the bot, stop the program. If it is holding coins when you stop it, they stay in your account; sell them yourself if you want cash.
