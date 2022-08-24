// I know it's really bad to have api keys in the open like this but
// this is a free account where I can't get overcharged and I plan to
// make the service availiable to the public, and I'll change the api
// key once I have time and care to code a better solution
const ASSEMBLY_AI_API_KEY = 'b97eef5fac7e4757ab5600899dc46f44'

msg = msg => M.toast({html: msg, classes: 'teal'})
suc = msg => M.toast({html: msg, classes: 'green'})
err = msg => M.toast({html: msg, classes: 'red'})

function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    reader = new FileReader()
    reader.onload = e => res(reader.result)
    reader.onerror = e => rej(reader.error)
    reader.onabort = e => rej(new Error("Read aborted"))
    reader.readAsDataURL(blob)
  })
}

function dataURLToBlob(dataurl) {
  return fetch(dataurl).then(r => r.blob())
}

function add_story(audio, title) {
  Firebase.firestore.add('stories', {
    uid: Firebase.auth.user().uid,
    audio: audio,
    time: Date.parse(new Date().toISOString()),
    text: false,
    title: title
  })
}

function get_stories() {
  stories = Firebase.firestore.get(
    'stories', false,
    [['uid', '==', Firebase.auth.user().uid]],
    [['time']], false, false, false
  )
  suc('Got the stories!')
  return stories
}

function post_assembly_ai(url, json) {
  return fetch(url, {
    method: 'POST',
    headers: {
      authorization: ASSEMBLY_AI_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify(json)
  }).then(r => r.json())
}

const { createApp } = Vue
const app = createApp({
  data() { return {
    chunks: [],
    rec: false,
    audio: false,
    stories: [],
    logged_in: false,
    login_form: {name: '', pass: ''},
    story_name: 'Untitled'
  }},
  methods: {
    record() {
      // Check if supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        err('Your browser doesn\'t support recording')
        return false
      }
      // Reset the chunks
      this.chunks = []
      // Check if there's a recorder
      if (!this.rec) {
        // Set up a recorder
        navigator.mediaDevices.getUserMedia({audio: true}).then(stream => {
          this.rec = new MediaRecorder(stream)
          this.rec.ondataavailable = e => this.chunks.push(e.data)
          // Handle saving the audio
          this.rec.onstop = e => blobToDataURL(
            new Blob(this.chunks, {type: 'audio/webm'})
          ).then(url => {
            this.audio = url
            add_story(this.audio, this.story_name)
            suc('Recording Complete!')
          }).catch(error => {
            // Handle errors
            err('Error while recording')
            console.error(error)
          })
          // Record
          this.rec.start()
        }).catch(error => {
          // Handle errors
          err('Error initializing recorder')
          console.error(error)
        })
      } else {
        // Record
        this.rec.start()
      }
    },
    stop() {
      // Stop the recording
      if (this.rec) this.rec.stop()
      this.rec = false
    },
    async load() {
      this.stories = (await get_stories()).map(d => ({...d.data(), docid: d.id}))
    },
    format_date(date) {
      return new Date(Number(date)).toLocaleString()
    },
    async transcribe(story) {
      if (story.text) return false
      story_blob = await dataURLToBlob(story.audio)
      path = `/tmp/rec${Math.random()}.webm`
      await Firebase.storage.upload(path, story_blob)
      resp = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          authorization: ASSEMBLY_AI_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({audio_url: await Firebase.storage.get_link(path)})
      }).then(r => r.json())
      while (resp.status != 'completed') {
        msg(resp.status)
        await new Promise(res => setTimeout(res, 2000))
        resp = await fetch('https://api.assemblyai.com/v2/transcript/' + resp.id, {
          headers: {authorization: ASSEMBLY_AI_API_KEY}
        }).then(r => r.json())
      }
      await Firebase.storage.delete(path)
      story.text = resp.text
      let {docid, ...data} = story
      await Firebase.firestore.update('stories', docid, data)
      suc('Transcription Complete!')
    },
    logout() {
      Firebase.auth.logout()
      .then(() => suc('Logged out successfully'))
      .catch(() => err('Error logging out'))
      window.location.reload()
    },
    login() {
      Firebase.auth.login(this.login_form.name, this.login_form.pass)
      .then(() => suc('Logged in successfully'))
      .catch(() => err('Error logging in'))
      this.login_form.name = ''
      this.login_form.pass = ''
    },
    signup() {
      Firebase.auth.create(this.login_form.name, this.login_form.pass)
      .then(() => suc('Signed up successfully'))
      .catch(() => err('Error signing up'))
      this.login_form.name = ''
      this.login_form.pass = ''
    },
    drop(docid) {
      Firebase.firestore.drop('stories', docid)
      .then(() => {
        suc('Deleted successfully')
        this.load()
      })
      .catch(() => err('Error deleting'))
    }
  }
}).mount('#app')

m_ready.then(() => {
  app.logged_in = Firebase.auth.user()
  Firebase.auth.set_on_auth_change(user => {
    app.logged_in = user
    if (app.logged_in) app.load()
  })
  if (app.logged_in) app.load()
})