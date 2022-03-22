import fetch from "isomorphic-fetch";
import {
  MsgExecuteContract,
  MnemonicKey,
  Coins,
  LCDClient,
} from "@terra-money/terra.js";
import { readFile } from "fs/promises";
import glob from "glob";
import path from 'path';

function shuffle(array) {
  let currentIndex = array.length,  randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

const ADDRESS = 'terra1h6xveq724d9gfe0748lxthh0527vllf0q0a9xr';

const IPFS_BUCKET = 'ipfs://QmS7QXvd4M69rBuR4YMpBHBc4LzVjYNjzQkd9F5xGREf1n';


const capitalize = (s) => {
  if (typeof s !== 'string') return s;
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Fetch gas prices and convert to `Coin` format.
const gasPrices = await (
  await fetch("https://fcd.terra.dev/v1/txs/gas_prices")
).json();
const gasPricesCoins = new Coins(gasPrices);

const lcd = new LCDClient({
  URL: "https://bombay-lcd.terra.dev/",
  chainID: "bombay-12",
  gasPrices: gasPricesCoins,
  gasAdjustment: "1.5",
  gas: 10000000,
});

const mk = new MnemonicKey({
  mnemonic: process.env.KEY,
  coinType: 118,
});

const wallet = lcd.wallet(mk);

const main = async () => {
  let cards;
  await new Promise((resolve) => {
    glob("./cards/*.png", function (err, files) {
      cards = shuffle(files);
      resolve();
    });
  });

  const names = cards.map(card => {
    const nameSplit = card.split('/');
    const nameMinusExtension = nameSplit[2].replace('.png', '');
    const [number, _, spade] = nameMinusExtension.split('_');
    return `${capitalize(number)} of ${capitalize(spade)}`;
  });

  const template = JSON.parse(await readFile("./template.json", "utf8"));
  const mintMessage = (tokenid, address, name, image) => ({
    mint: {
      owner: address,
      token_id: `${tokenid}`,
      extension: {
        ...template.extension,
        name,
        image: `${IPFS_BUCKET}/${image}`,
      },
    },
  });
  const list = (await readFile("./list.txt", "utf8")).split("\n");
    const msgs = cards.map((card, i) => {
      const addr = list[i];
      const name = names[i];
      const cardBase = path.parse(card).base;
    
      if (!addr) {
        return;
      }

      const msg = mintMessage(i, addr, name, cardBase);

      return new MsgExecuteContract(
        wallet.key.accAddress,
        ADDRESS,
        msg
      );
    }).filter(a => a);
 
    try {
      const tx = await wallet.createAndSignTx({ msgs });
      const result = await lcd.tx.broadcast(tx);
      console.log(result);
    } catch (e) {
      console.log(e);
    }
};

main();
