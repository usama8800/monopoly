import { input, select } from '@inquirer/prompts';
import { ConsoleMonopoly } from './console_monopoly';
import { Player, TradeItem } from './player';
import { OwnableBoardItem, Property } from './utils';

export class ConsolePlayer extends Player {
  declare game: ConsoleMonopoly;
  type = 'console';

  async wantOutOfJail() {
    const selection = await select({
      message: `${this.game.localizePlayer(this.index)}: You're in jail, what would you like to do?`,
      choices: [
        ...(this.jailCards ? [{ name: 'Use jail card', value: 'card' }] : []),
        { name: 'Pay', value: 'money' },
        { name: 'Just roll', value: 'none' },
      ],
    });
    if (selection === 'card' || selection === 'money') return selection;
    return 'none';
  }

  async willBuy(tile: OwnableBoardItem) {
    if (this.money < tile.cost) return false;
    return await select({
      message: `${this.game.localizePlayer(this.index)}: Do you want to buy ${this.game.localizeItem(tile)} for ${this.game.localizeMoney(tile.cost)}?`,
      choices: [
        { name: 'Buy', value: true },
        { name: 'Auction', value: false },
      ],
    });
  }

  async bid(tile: OwnableBoardItem, highestBid: number, highestBidder: number) {
    if (highestBid > this.money) return 0;
    const ans = await input({
      message: `${this.game.localizePlayer(this.index)}: How much do you want to bid for ${this.game.localizeItem(tile)}? Current highest bid is ${this.game.localizeMoney(highestBid)} by ${this.game.localizePlayer(highestBidder)}: `,
      validate: (val) => {
        const num = +val;
        if (isNaN(num)) return 'Please enter a number';
        if (num > this.money) return 'You don\'t have enough money';
        return true;
      },
    });
    return +ans;
  }

  async endTurn() {
    while (true) {
      const selected = await select({
        message: `${this.game.localizePlayer(this.index)}: What do you want to do?`,
        choices: [
          { name: 'Build', value: 'build' },
          { name: 'Demolish', value: 'demolish' },
          { name: 'Mortgage', value: 'mortgage' },
          { name: 'Unmortgage', value: 'unmortgage' },
          { name: 'Trade', value: 'trade' },
          { name: 'End turn', value: 'end' },
        ],
      });
      if (selected === 'build') await this.askBuild();
      if (selected === 'demolish') await this.askDemolish();
      if (selected === 'mortgage') await this.askMortgage();
      if (selected === 'unmortgage') await this.askUnmortgage();
      if (selected === 'trade') {
        await this.trade();
      }
      if (selected === 'end') break;
    }
    return;
  }

  async receiveTradeOffer(giving: TradeItem[], receiving: TradeItem[], from: Player) {
    console.log(`${this.game.localizePlayer(this.index)}: ${this.game.localizePlayer(from.index)} offers you the following trade:`);
    this.printTrade(giving, receiving);
    return await select({
      message: 'Do you accept the trade?',
      choices: [
        { name: 'Yes', value: true },
        { name: 'No', value: false },
      ],
    });
  }

  async makeMoney(amount: number) {
    console.log(`${this.game.localizePlayer(this.index)}: You need to make ${this.game.localizeMoney(amount)}`);
    let made = 0;
    while (made < amount) {
      const selected = await select({
        message: `${this.game.localizePlayer(this.index)}: What would you like to do?`,
        choices: [
          { name: 'Mortgage', value: 'mortgage' },
          { name: 'Demolish', value: 'demolish' },
          { name: 'Trade', value: 'trade' },
          { name: 'Declare Bankruptcy', value: 'end' },
        ],
      });
      if (selected === 'end') break;
      if (selected === 'mortgage') {
        const title = await this.askMortgage();
        if (title) made += title.cost * this.game.config.mortgageMultiplier;
      } else if (selected === 'demolish') {
        const property = await this.askDemolish();
        if (property) made += property.buildingCost * this.game.config.demolishMultiplier;
      } else if (selected === 'trade') {
        await this.trade();
      }
    }
    return amount - made;
  }

  async askBuild(): Promise<false | Property> {
    const selected = await select({
      message: `${this.game.localizePlayer(this.index)}: Where would you like to build?`,
      choices: [
        ...this.properties()
          .filter(p => this.game.set(p.set).some(s => s.owner !== this.index))
          .map(p => ({ name: `${this.game.localizeItem(p)} (Building cost ${this.game.localizeMoney(p.buildingCost)})`, value: p }))
        ,
        { name: 'Cancel', value: undefined },
      ]
    });
    if (!selected) return false;
    if (await this.build(selected, 1)) return selected;
    return false;
  }

  async askDemolish(): Promise<false | Property> {
    const selected = await select({
      message: `${this.game.localizePlayer(this.index)}: Where would you like to demolish from?`,
      choices: [
        ...this.properties()
          .filter(p => this.game.set(p.set).some(s => s.owner !== this.index))
          .map(p => ({ name: `${this.game.localizeItem(p)} (Building cost ${this.game.localizeMoney(p.buildingCost)})`, value: p }))
        ,
        { name: 'Cancel', value: undefined },
      ]
    });
    if (!selected) return false;
    if (this.demolish(selected)) return selected;
    return false;
  }

  async askMortgage(): Promise<false | OwnableBoardItem> {
    const title = await select({
      message: `${this.game.localizePlayer(this.index)}: Which property would you like to mortgage?`,
      choices: [
        ...this.titles().filter(t => !t.mortgaged).map(t => ({
          name: `${this.game.localizeItem(t)} - ${this.game.localizeMoney(t.cost * this.game.config.mortgageMultiplier)}`,
          value: t
        })),
        { name: 'Cancel', value: undefined },
      ],
    });
    if (!title) return false;
    if (this.mortgage(title)) return title;
    return false;
  }

  async askUnmortgage(): Promise<false | OwnableBoardItem> {
    const title = await select({
      message: `${this.game.localizePlayer(this.index)}: Which property would you like to unmortgage?`,
      choices: [
        ...this.titles().filter(t => t.mortgaged).map(t => ({
          name: `${this.game.localizeItem(t)} - ${this.game.localizeMoney(t.cost * this.game.config.mortgageMultiplier)}`,
          value: t
        })),
        { name: 'Cancel', value: undefined },
      ],
    });
    if (!title) return false;
    if (await this.unmortgage(title)) return title;
    return false;
  }

  async trade() {
    const [to, giving, receiving] = await this.generateTrade();
    if (to === -1) return false;
    const accepted = await this.sendTradeOffer(giving, receiving, this.game.players[to]);
    if (!accepted) this.game.pushActions({ action: 'Trade Declined', declinedBy: to, tradeFrom: this.index });
    return accepted;
  }

  async generateTrade(): Promise<[number, TradeItem[], TradeItem[]]> {
    const giving: TradeItem[] = [];
    const receiving: TradeItem[] = [];
    const who = await select({
      message: `${this.game.localizePlayer(this.index)}: Who would you like to trade with?`,
      choices: [
        ...this.game.players
          .filter(p => p.index !== this.index)
          .map(p => ({ name: this.game.localizePlayer(p.index), value: p.index })),
        { name: 'Cancel', value: undefined },
      ],
    });
    if (!who) return [-1, giving, receiving];
    while (true) {
      console.log('Current Trade:');
      this.printTrade(giving, receiving);
      const selected = await select({
        message: `${this.game.localizePlayer(this.index)}: What would you like to trade?`,
        choices: [
          { name: 'Give Get out of Jail card', value: 'give jailcard' },
          { name: 'Receive Get out of Jail card', value: 'recevie jailcard' },
          { name: 'Give Money', value: 'give money' },
          { name: 'Receive Money', value: 'receive money' },
          { name: 'Give Title', value: 'give title' },
          { name: 'Receive Title', value: 'receive title' },
          { name: 'Remove from giving', value: 'giving' },
          { name: 'Remove from receiving', value: 'receiving' },
          { name: 'Cancel', value: 'cancel' },
          { name: 'Done', value: 'done' },
        ],
        pageSize: 15,
      });
      if (selected === 'cancel') return [-1, [], []];
      if (selected === 'give jailcard') {
        if (this.jailCards === 0) {
          console.log('You don\'t have any Get out of Jail cards');
          continue;
        }
        const howMany = await input({
          message: `${this.game.localizePlayer(this.index)}: How many Get out of Jail cards would you like to give?`,
          validate: (val) => {
            const num = +val;
            if (isNaN(num)) return 'Please enter a number';
            if (num > this.jailCards) return 'You don\'t have that many Get out of Jail cards';
            return true;
          },
        });
        giving.push({ jailCards: +howMany });
      } else if (selected === 'receive jailcard') {
        const howMany = await input({
          message: `${this.game.localizePlayer(this.index)}: How many Get out of Jail cards would you like to receive?`,
          validate: (val) => {
            const num = +val;
            if (isNaN(num)) return 'Please enter a number';
            return true;
          },
        });
        receiving.push({ jailCards: +howMany });
      } else if (selected === 'give money') {
        const howMuch = await input({
          message: `${this.game.localizePlayer(this.index)}: How much money would you like to give?`,
          validate: (val) => {
            const num = +val;
            if (isNaN(num)) return 'Please enter a number';
            if (num > this.money) return 'You don\'t have that much money';
            return true;
          },
        });
        giving.push({ money: +howMuch });
      } else if (selected === 'receive money') {
        const howMuch = await input({
          message: `${this.game.localizePlayer(this.index)}: How much money would you like to receive?`,
          validate: (val) => {
            const num = +val;
            if (isNaN(num)) return 'Please enter a number';
            return true;
          },
        });
        receiving.push({ money: +howMuch });
      } else if (selected === 'give title') {
        const title = await select({
          message: `${this.game.localizePlayer(this.index)}: Which title would you like to give?`,
          choices: [
            ...this.titles().map(t => ({ name: this.game.localizeItem(t), value: t })),
            { name: 'Cancel', value: undefined },
          ],
        });
        if (!title) continue;
        giving.push({ tile: title });
      } else if (selected === 'receive title') {
        const title = await select({
          message: `${this.game.localizePlayer(this.index)}: Which title would you like to receive?`,
          choices: [
            ...who.titles().map(t => ({ name: this.game.localizeItem(t), value: t })),
            { name: 'Cancel', value: undefined },
          ],
        });
        if (!title) continue;
        receiving.push({ tile: title });
      } else if (selected === 'giving') {
        const index = await select({
          message: `${this.game.localizePlayer(this.index)}: Which item would you like to remove?`,
          choices: [
            ...giving.map((_, i) => ({ name: `Item ${i + 1}`, value: i })),
            { name: 'Cancel', value: undefined },
          ],
        });
        if (index === undefined) continue;
        giving.splice(index, 1);
      } else if (selected === 'receiving') {
        const index = await select({
          message: `${this.game.localizePlayer(this.index)}: Which item would you like to remove?`,
          choices: [
            ...receiving.map((_, i) => ({ name: `Item ${i + 1}`, value: i })),
            { name: 'Cancel', value: undefined },
          ],
        });
        if (index === undefined) continue;
        receiving.splice(index, 1);
      } else if (selected === 'done') {
        return [+who, giving, receiving];
      }
    }
  }

  printTrade(giving: TradeItem[], receiving: TradeItem[]) {
    console.log('Giving:');
    if (giving.length === 0) console.log('- Nothing');
    for (let i = 0; i < giving.length; i++) {
      const item = giving[i];
      if (item.jailCards) console.log(`${i + 1}. ${item.jailCards} Get out of Jail card${item.jailCards > 1 ? 's' : ''}`);
      else if (item.money) console.log(`${i + 1}. ${this.game.localizeMoney(item.money)}`);
      else if (item.tile) console.log(`${i + 1}. ${this.game.localizeItem(item.tile)}`);
    }
    console.log('Receiving:');
    if (receiving.length === 0) console.log('- Nothing');
    for (let i = 0; i < receiving.length; i++) {
      const item = receiving[i];
      if (item.jailCards) console.log(`${i + 1}. ${item.jailCards} Get out of Jail card${item.jailCards > 1 ? 's' : ''}`);
      else if (item.money) console.log(`${i + 1}. ${this.game.localizeMoney(item.money)}`);
      else if (item.tile) console.log(`${i + 1}. ${this.game.localizeItem(item.tile)}`);
    }
  }
}
