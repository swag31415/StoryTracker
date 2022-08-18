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

const { createApp } = Vue
const app = createApp({
  data() { return {
    chunks: [],
    rec: false,
    audio: false
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
            console.log(this.audio) // TODO remove
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
    }
  }
}).mount('#app')
