import { $ } from './dom.js'

class GoogleTranslator {
  constructor() {
    this.init()
    this.setupEventListeners()

    this.translationTimeout = null
    this.currentTranslator = null
    this.currentTranslatorKey = null
    this.currentDetector = null
  }

  static DEFAULT_SOURCE_LANGUAGE = 'es'
  static DEFAULT_TARGET_LANGUAGE = 'en'

  static SUPPORTED_LANGUAGES = [
    'en',
    'es',
    'fr',
    'de',
    'it',
    'pt',
    'zh',
    'ja',
    'ru',
  ]

  static FULL_LANGUAGE_CODES = {
    es: 'es-ES',
    fr: 'fr-FR',
    de: 'de-DE',
    it: 'it-IT',
    pt: 'pt-PT',
    zh: 'zh-CN',
    ja: 'ja-JP',
    ru: 'ru-RU',
    en: 'en-US',
  }

  init() {
    //Recuperamos todos los elementos del DOM
    this.sourceLanguage = $('#sourceLanguage')
    this.targetLanguage = $('#targetLanguage')

    this.inputText = $('#inputText')
    this.outputText = $('#outputText')
    this.swapButton = $('#swapButton')

    this.micButton = $('#micButton')
    this.copyButton = $('#copyButton')
    this.speakerButton = $('#speakerButton')

    this.charCount = $('#charCount')

    //Configuración incial
    this.targetLanguage.value = GoogleTranslator.DEFAULT_TARGET_LANGUAGE
    // this.sourceLanguage.value = GoogleTranslator.DEFAULT_SOURCE_LANGUAGE

    //Verificar que el usuario tiene soporte para la API de traducción
    this.checkAPISupport()
  }

  checkAPISupport() {
    this.hasNativeTranslator = 'Translator' in window
    this.hasNativeDetector = 'LanguageDetector' in window

    if (!this.hasNativeTranslator || !this.hasNativeDetector) {
      console.warn(
        'Tu navegador no soporta la API de traducción de Google. Por favor, actualiza tu navegador o usa uno compatible.'
      )
      return
    } else {
      console.log('Tu navegador soporta la API de traducción de Google.✅')
    }
  }

  setupEventListeners() {
    this.inputText.addEventListener('input', () => {
      //Actualizar el contador de letras
      this.updateCharCount()

      //Traducir el texto con un debounce para evitar múltiples
      this.debounceTranslate()
    })
    this.sourceLanguage.addEventListener('change', () => this.translate())
    this.targetLanguage.addEventListener('change', () => this.translate())

    this.swapButton.addEventListener('click', () => this.swapLanguages())

    this.micButton.addEventListener('click', () => this.startVoiceRecognition())
    this.speakerButton.addEventListener('click', () => this.speakTranslation())
    this.copyButton.addEventListener('click', () => this.copyTranslation())
  }

  updateCharCount() {
    const text = this.inputText.value
    this.charCount.textContent = text.length

    //Limitar el número de caracteres a 5000
    if (text.length >= 5000) {
      this.charCount.style.color = 'var(--google-red)'
    } else {
      this.charCount.style.color = 'var(--text-secondary)'
    }
  }

  debounceTranslate() {
    clearTimeout(this.translationTimeout)
    this.translationTimeout = setTimeout(() => {
      this.translate()
    }, 500)
  }

  updateDetectedLanguage(detectedLanguage) {
    //Actualizar el idioma de origen al idioma detectado
    const option = this.sourceLanguage.querySelector(
      `option[value="${detectedLanguage}"]`
    )
    if (option) {
      const autoOption = this.sourceLanguage.querySelector(
        'option[value="auto"]'
      )
      // Si el idioma detectado es soportado, actualizar el idioma de origen
      autoOption.textContent = `Detectar idioma (${option.textContent})`
    } else {
      console.warn(
        `El idioma detectado (${detectedLanguage}) no está soportado`
      )
      //   this.sourceLanguage.value = GoogleTranslator.DEFAULT_SOURCE_LANGUAGE
    }
  }

  async getTranslation(text) {
    const sourceLang =
      this.sourceLanguage.value === 'auto'
        ? await this.detectLanguage(text)
        : this.sourceLanguage.value
    const targetLang = this.targetLanguage.value

    if (sourceLang === targetLang) return text

    //1. Verificar la disponibilidad de la traducción entre los idiomas seleccionados
    try {
      const status = await window.Translator.availability({
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
      })

      if (status === 'unavailable') {
        throw new Error(
          'La traducción no está disponible para los idiomas seleccionados.'
        )
      }
    } catch (error) {
      console.error(
        'Error al verificar la disponibilidad de la traducción:',
        error
      )
      throw new Error('Error al verificar la disponibilidad de la traducción.')
    }

    //2. Realizar la traducción
    const translationKey = `${sourceLang}-${targetLang}`

    try {
      if (
        !this.currentTranslator ||
        this.currentTranslatorKey !== translationKey
      ) {
        this.currentTranslator = await window.Translator.create({
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
          monitor: (monitor) => {
            monitor.addEventListener('downloadprogress', (event) => {
              this.outputText.textContent = `Descargando modelo: ${Math.floor(
                event.loaded * 100
              )}%`
            })
          },
        })
      }

      this.currentTranslatorKey = translationKey

      const translation = await this.currentTranslator.translate(text)
      return translation
    } catch (error) {
      console.error('Error al crear el traductor:', error)
      return 'Error al traducir el texto.'
    }
  }

  async translate() {
    const text = this.inputText.value.trim()
    if (!text) {
      this.outputText.textContent = ''
      return
    }

    this.outputText.textContent = 'Traduciendo...'

    if (this.sourceLanguage.value === 'auto') {
      //Detectar el idioma del texto ingresado
      const detectedLanguage = await this.detectLanguage(text)
      this.updateDetectedLanguage(detectedLanguage)
    }

    try {
      //Llamar a la función getTranslation para obtener la traducción
      const translation = await this.getTranslation(text)
      this.outputText.textContent = translation
    } catch (error) {
      console.error('Error al obtener los idiomas:', error)
      const hasSupport = this.checkAPISupport()
      if (!hasSupport) {
        this.outputText.textContent =
          'Tu navegador no soporta la API de traducción de Google. Por favor, actualiza tu navegador o usa uno compatible.'
        return
      } else {
        this.outputText.textContent = 'Error al traducir el texto.'
        return
      }
    }
  }

  async swapLanguages() {
    //Detectar si el sourceLanguage es 'auto'
    if (this.sourceLanguage.value === 'auto') {
      const detectedLanguage = await this.detectLanguage(
        this.inputText.value.trim()
      )
      this.sourceLanguage.value = detectedLanguage
    }

    //Intercambiar los idiomas del sourceLanguage y el targetLanguage
    const temp = this.sourceLanguage.value
    this.sourceLanguage.value = this.targetLanguage.value
    this.targetLanguage.value = temp

    this.inputText.value = this.outputText.textContent
    this.outputText.textContent = ''

    this.updateCharCount()

    //Actualizar la traducción después de intercambiar los idiomas
    if (this.inputText.value.trim()) {
      this.translate()
    }

    //Restaurar la opción de idioma de origen a 'auto' si es necesario
  }

  getFullLanguageCode(language) {
    return (
      GoogleTranslator.FULL_LANGUAGE_CODES[language] ??
      GoogleTranslator.DEFAULT_SOURCE_LANGUAGE
    )
  }

  async startVoiceRecognition() {
    const hasSpeechRecognition =
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
    if (!hasSpeechRecognition) return

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.continuous = false
    recognition.interimResults = false

    const language =
      this.sourceLanguage.value === 'auto'
        ? await this.detectLanguage(this.inputText.value.trim())
        : this.sourceLanguage.value

    recognition.lang = this.getFullLanguageCode(language)

    recognition.onstart = () => {
      this.inputText.placeholder = 'Escuchando...'
      this.micButton.style.backgroundColor = 'var(--google-red)'
      this.micButton.style.color = 'white'
    }

    recognition.onend = () => {
      this.inputText.placeholder = 'Introduce el texto'
      this.micButton.style.backgroundColor = ''
      this.micButton.style.color = ''
    }

    recognition.onresult = (event) => {
      const [{ transcript }] = event.results[0]
      this.inputText.value = transcript
      this.updateCharCount()
      this.translate()
    }

    recognition.onerror = (event) => {
      console.error('Error en el reconocimiento de voz:', event.error)
      this.inputText.placeholder = 'Error al escuchar'
    }

    recognition.start()
  }

  speakTranslation() {
    const hasNativeSupportSysthesis = 'speechSynthesis' in window
    if (!hasNativeSupportSysthesis) return

    const text = this.outputText.textContent
    if (!text) return

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = this.getFullLanguageCode(this.targetLanguage.value)
    utterance.rate = 1 // Velocidad de la voz

    utterance.onstart = () => {
      this.speakerButton.style.backgroundColor = 'var(--google-green)'
      this.speakerButton.style.color = 'white'
    }
    utterance.onend = () => {
      this.speakerButton.style.backgroundColor = ''
      this.speakerButton.style.color = ''
    }
    utterance.onerror = (event) => {
      console.error('Error en la síntesis de voz:', event.error)
    }

    window.speechSynthesis.speak(utterance)
  }

  copyTranslation() {
    const text = this.outputText.textContent
    if (!text) return

    navigator.clipboard
      .writeText(text)
      .then(() => {
        console.log('Texto copiado al portapapeles')
      })
      .catch((error) => {
        console.error('Error al copiar el texto:', error)
      })
  }

  async detectLanguage(text) {
    try {
      if (!this.currentDetector) {
        this.currentDetector = await window.LanguageDetector.create({
          expectedInputLanguages: GoogleTranslator.SUPPORTED_LANGUAGES,
        })
      }

      const results = await this.currentDetector.detect(text)
      const detectedLanguage = results[0]?.detectedLanguage
      //   console.log(
      //     `Idioma detectado: ${detectedLanguage} (${results[0]?.confidence})`
      //   )
      return detectedLanguage === 'und'
        ? googleTranslator.DEFAULT_SOURCE_LANGUAGE
        : detectedLanguage
    } catch (error) {
      console.error('Error al detectar el idioma:', error)
      return googleTranslator.DEFAULT_SOURCE_LANGUAGE
    }
  }
}

const googleTranslator = new GoogleTranslator()
