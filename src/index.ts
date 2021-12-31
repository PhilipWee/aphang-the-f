import { EzBackend, EzRepo, Type } from '@ezbackend/common';

import { Telegraf, Scenes, session } from 'telegraf'


const app = new EzBackend();
const bot = new Telegraf(process.env.BOT_TOKEN)

const CATCH_PHRASE_SCENE_ID = 'CATCH_PHRASE_SCENE_ID'
const DELETE_SCENE_ID = 'DELETE_SCENE_ID'


// Models are also ezapps in ezbackend
const catchPhrase = new EzRepo('CatchPhrase', {
  title: {
    type: Type.VARCHAR,
    unique: true
  }, // string
  meaning: Type.INT, // integer
});

function getText(ctx) {
  if (!ctx.message?.text) {
    ctx.reply("Eh the bot got some problem or you didn't send the text properly")
    ctx.scene.leave()
  }
  return ctx.message.text
}

function getInputFromCommand(ctx) {
  const inputMessage = getText(ctx)
  const input = inputMessage.substring(inputMessage.indexOf(" ") + 1)
  return input
}

const deleteWizard = new Scenes.WizardScene(
  DELETE_SCENE_ID,
  (ctx) => {
    const deleteTitle = getInputFromCommand(ctx)
    ctx.wizard.state['deleteData'] = { deleteTitle }
    ctx.reply(`Are you sure you wanna delete ${deleteTitle}? (yes/no)`)
    ctx.wizard.next()
  },
  async (ctx) => {
    if (getText(ctx) === 'yes') {
      const data = ctx.wizard.state['deleteData']
      const repo = catchPhrase.getRepo()
      const original = await repo.findOne({ title: data.deleteTitle })
      if (original) {
        await repo.delete({ title: data.deleteTitle })
        ctx.reply("Ok deleted")
      } else {
        ctx.reply("Harlo it doesnt exist")
      }
      ctx.scene.leave()
      return
    } else if (getText(ctx) === 'no') {
      ctx.reply("Then next time type correctly lah")
      ctx.scene.leave()
      return
    }
    ctx.reply("That is not a valid option. Type either yes/no. Can listen to instructions anot")
  }
)

const catchPhraseWizard = new Scenes.WizardScene(
  CATCH_PHRASE_SCENE_ID,
  (ctx) => {
    ctx.reply("What is the catch phrase?")
    ctx.wizard.state['catchPhraseData'] = {}
    ctx.wizard.next()
  },
  (ctx) => {
    ctx.wizard.state['catchPhraseData'].title = getText(ctx)
    ctx.reply("What is the meaning of the catch phrase?")
    ctx.wizard.next()
  },
  (ctx) => {
    ctx.wizard.state['catchPhraseData'].meaning = getText(ctx)
    const data = ctx.wizard.state['catchPhraseData']
    ctx.reply(`Please confirm that the catch phrase is ${data.title} and the meaning is ${data.meaning}. (Type lowercase yes/no)`)
    ctx.wizard.next()
  },
  async (ctx) => {
    if (getText(ctx) === 'yes') {
      const data = ctx.wizard.state['catchPhraseData']
      const repo = catchPhrase.getRepo()
      const original = await repo.findOne({ title: data.title })
      await repo.save({
        id: original?.id ?? undefined,
        title: data.title,
        meaning: data.meaning
      })
      ctx.reply("Ok can")
      ctx.scene.leave()
      return
    } else if (getText(ctx) === 'no') {
      ctx.reply("Then next time type correctly lah")
      ctx.scene.leave()
      return
    }
    ctx.reply("That is not a valid option. Type either yes/no. Can listen to instructions anot")
  }
)



bot.command('what_is', async (ctx) => {
  const title = getInputFromCommand(ctx)
  const repo = catchPhrase.getRepo()
  const original = await repo.findOne({ title: title })
  if (title === "" || title === "/what_is") {
    ctx.reply("You need to specify what you want to know. FOLLOW PLEASE")
    return
  }
  if (original) {
    ctx.reply(original.meaning)
    return
  } else {
    ctx.reply('That is not in the database yet but you can add it with /new')
    return
  }
})

bot.command('list_all', async (ctx) => {
  const repo = catchPhrase.getRepo()
  const result = await repo.find()
  const allCatchPhrases = result.map((catchPhrase) => {
    return catchPhrase.title
  })
  const listString = allCatchPhrases
  const resultFinal = 'Here you go: \n' + listString.join('\n')
  ctx.reply(resultFinal)
})

//@ts-ignore
const stage = new Scenes.Stage([catchPhraseWizard, deleteWizard])

bot.use(session())
bot.use(stage.middleware())

bot.command('new', (ctx) => {
  //@ts-ignore
  ctx.scene.enter(CATCH_PHRASE_SCENE_ID)
})

bot.command('delete', (ctx) => {
  //@ts-ignore
  ctx.scene.enter(DELETE_SCENE_ID)
})


app.addApp(catchPhrase);

console.log("beep boop")

async function run() {
  if (process.env.NODE_ENV === 'production') {
    console.log('productioning')
    await app.start({
      backend: {
        listen: {
          address: '0.0.0.0'
        },
        typeorm: {
          type: 'postgres',
          url: process.env.DATABASE_URL,
          ssl: true
        }
      }
    });
    console.log("app started yoo hoo")
  } else {
    app.start()
  }
  
  bot.launch()
}

run()
