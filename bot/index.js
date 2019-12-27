// include requirements
const Telegraf           = require('telegraf'),
      TelegrafInlineMenu = require('telegraf-inline-menu'),
      TelegrafSession    = require('telegraf-session-local'),
      winston            = require('winston');

// configuration variables with default values
const loglevel         = process.env.LOGLEVEL || 'info',
      reply_format     = {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      },
      reply_timeout    = process.env.REPLY_TIMEOUT || 5,
      session_filename = 'data/session.json',
      telegram_key     = process.env.TELEGRAM_KEY;

// initialize some components (bot, winston, etc.)
const bot = new Telegraf(telegram_key);
const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      level: loglevel,
      handleExceptions: true,
      format: winston.format.combine(
        winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`+(info.splat!==undefined? `${info.splat}.` : '.'))
      )
    })
  ]
});

// search filters to create submenus programatically
const filters = [
  {
    'name': 'maxprice',
    'title': 'Max. Price',
    'values': ['Any', '30', '40', '50', '60', '70', '80', '90', '100', '110', '120', '130', '140', '150', '200'],
    'menu': new TelegrafInlineMenu('Set the max. price (excl. VAT):'),
    'joinLastRow': false
  },
  {
    'name': 'minhd',
    'title': 'Min. HD',
    'values': ['Any', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
    'menu': new TelegrafInlineMenu('Set the min. number of disks:'),
    'joinLastRow': true
  },
  {
    'name': 'minram',
    'title': 'Min. RAM',
    'values': ['Any', '2', '4', '8', '12', '16', '24', '32', '48', '64', '96', '128', '256', '512', '768'],
    'menu': new TelegrafInlineMenu('Set the min. RAM size in GB:'),
    'joinLastRow': true
  },
  {
    'name': 'cputype',
    'title': 'CPU Type',
    'values': ['Any', 'Intel', 'AMD'],
    'menu': new TelegrafInlineMenu('Set the preferred CPU type:'),
    'joinLastRow': false
  },
/*   {
    'name': 'ssd',
    'title': 'SSD',
    'values': ['Any', 'Yes', 'No'],
    'menu': new TelegrafInlineMenu('Set the preference for SSD disks:'),
    'joinLastRow': true
  }
 */
];

// settings submenu definition
const filtersMenu = new TelegrafInlineMenu('Choose an option to change your search preferences:');
// settings -> button to see current settings
filtersMenu.simpleButton('📄 View current filters', 'configure-filters', {
  doFunc: ctx => {
    let message = 'This is the current filters configuration:\n';
    for(const [name, filter] of Object.entries(ctx.session.filters)) {
      message += ` - *${filter[0]}*: ${filter[1]}\n`;
    }
    ctx.reply(message, reply_format)
    .then(({ message_id }) => {
      setTimeout(() => ctx.deleteMessage(message_id), reply_timeout*1000);
    });
  }
});
// settings -> submenus for each filter option
filters.forEach(item => {
  // create the filter submenu
  item.menu.select(`set-${item.name}`, item.values, {
    setFunc: (ctx, key) => {
      // set the value in the session
      logger.debug(`${ctx.update.callback_query.from.username} sets ${item.name} => ${key}`);
      ctx.session.filters[item.name] = [item.title, key];
    },
    isSetFunc: (ctx, key) => {
      try {
        // return (true) if user is viewing this specific value
        return ctx.session.filters[item.name][1] === key;
      }
      catch (error) { 
        // initialize filters in session if error
        if (typeof ctx.session.filters === 'undefined') {
          ctx.session.filters = {};
          filters.forEach(filter => {
            ctx.session.filters[filter.name] = [filter.title, filter.values[0]];
          });
        }
        // return (true) if user is viewing this specific value after initialize
        return ctx.session.filters[item.name][1] === key;
      }
    }
  });
  // add the filter submenu to the settings submenu
  filtersMenu.submenu(item.title, item.name, item.menu, {joinLastRow: item.joinLastRow});
});

// main menu
const menu = new TelegrafInlineMenu('Choose an option:');
menu.setCommand('start');
menu.submenu('🔧 Filters', 'filters', filtersMenu);
menu.simpleButton('🔍 Search now', 'search-now', {
  doFunc: ctx => {
    ctx.reply('This feature is under development. Not results so far.')
    .then(({ message_id }) => {
      setTimeout(() => ctx.deleteMessage(message_id), reply_timeout*1000);
    });
  },
  joinLastRow: true
});
menu.simpleButton('ℹ️ Help', 'help', {
  doFunc: ctx => {
    let message = 'This is a helper bot for [Hetzner Auction Servers channel]';
    message += '(https://t.me/hetznerauctionservers).\n\n*INSTRUCTIONS*:\n';
    message += ' - Use /start to show the main menu at any moment.\n';
    message += ' - Use the Settings menu to set your search preferences and you ';
    message += 'will get notified for new servers matching your criteria.\n';
    message += ' - Messages from the bot will be deleted automatically after ';
    message += `some time (or when the server time expires) in order to keep the`;
    message += ' interface clean\n\n';
    message += '*IMPORTANT:* This bot is under heavy development. The ';
    message += 'search and notification features won\'t probably work yet.';

    ctx.reply(message, reply_format)
    .then(({ message_id }) => {
      setTimeout(() => ctx.deleteMessage(message_id), reply_timeout*2*1000);
    });
  }
});

// set bot options (session, menu, callbacks and catch errors)
bot.use((new TelegrafSession({ database: session_filename })).middleware());

bot.use(menu.init({
  backButtonText: '⏪ Previous menu',
  mainMenuButtonText: '⏮️ Main menu'
}));

bot.use((ctx, next) => {
  if (ctx.callbackQuery) {
    logger.info(`Another callbackQuery happened ${ctx.callbackQuery.data.length} ${ctx.callbackQuery.data}`);
  }
  return next();
});

bot.catch(error => {
  logger.error(`Telegraf error ${error.response} ${error.parameters} ${error.on || error}`);
});

// main function
async function startup() {
  await bot.launch();
  logger.info(`Bot started as ${ bot.options.username }`);
}
startup();
