package com.wae.universalcore

import android.app.Activity
import android.os.Bundle
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.content.pm.PackageManager
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import java.util.Locale
import java.util.UUID

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var speechRecognizer: SpeechRecognizer? = null
    private var speechSessionId: String? = null

    companion object {
        private const val START_URL =
            "https://wae-inteligencia-universal-vt3h.onrender.com/?source=android-native"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)
        configureWebView()
        requestMicrophonePermission()
        initTts()
        webView.loadUrl(START_URL)
    }

    private fun requestMicrophonePermission() {
        if (android.os.Build.VERSION.SDK_INT >= 23 &&
            checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(android.Manifest.permission.RECORD_AUDIO), 1001)
        }
    }

    private fun configureWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = "$userAgentString UniversalCoreAndroid/1.0"
        }
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()
        webView.addJavascriptInterface(NativeVoiceBridge(), "WAE_NATIVE_VOICE")
        webView.addJavascriptInterface(NativeInputBridge(), "WAE_NATIVE_VOICE_INPUT")
    }

    private fun initTts() {
        tts = TextToSpeech(this) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (!ttsReady) return@TextToSpeech

            val mx = Locale("es", "MX")
            val es = Locale("es", "ES")
            val selected = when {
                tts?.isLanguageAvailable(mx) ?: -1 >= TextToSpeech.LANG_AVAILABLE -> mx
                tts?.isLanguageAvailable(es) ?: -1 >= TextToSpeech.LANG_AVAILABLE -> es
                else -> Locale.getDefault()
            }
            tts?.language = selected
            tts?.setSpeechRate(0.98f)
            tts?.setPitch(1.0f)
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String) = Unit
                override fun onDone(utteranceId: String) = notifyVoiceResult(utteranceId, true, "")
                override fun onError(utteranceId: String) =
                    notifyVoiceResult(utteranceId, false, "android_tts_error")
            })
        }
    }

    private fun notifyVoiceResult(id: String, ok: Boolean, error: String) {
        runOnUiThread {
            val safeId = id.replace("\", "\\").replace("'", "\'")
            val safeError = error.replace("\", "\\").replace("'", "\'")
            webView.evaluateJavascript(
                "window.__waeNativeVoiceComplete&&window.__waeNativeVoiceComplete('$safeId',$ok,'$safeError')",
                null
            )
        }
    }

    private fun notifyInputResult(session: String, text: String?, error: String?) {
        runOnUiThread {
            val safeSession = session.replace("\\", "\\\\").replace("'", "\\'")
            val safeText = (text ?: "").replace("\\", "\\\\").replace("'", "\\'")
            val safeError = (error ?: "").replace("\\", "\\\\").replace("'", "\\'")
            webView.evaluateJavascript(
                "window.__waeNativeVoiceInputComplete&&window.__waeNativeVoiceInputComplete('$safeSession','$safeText','$safeError')",
                null
            )
        }
    }

    private inner class NativeInputBridge {
        @JavascriptInterface
        fun isAvailable(): Boolean = SpeechRecognizer.isRecognitionAvailable(this@MainActivity)

        @JavascriptInterface
        fun start(language: String): String {
            val session = UUID.randomUUID().toString()
            speechSessionId = session
            runOnUiThread {
                if (!SpeechRecognizer.isRecognitionAvailable(this@MainActivity)) {
                    notifyInputResult(session, null, "android_speech_unavailable")
                    return@runOnUiThread
                }
                speechRecognizer?.destroy()
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this@MainActivity)
                speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                    override fun onResults(results: android.os.Bundle) {
                        val text = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                        notifyInputResult(session, text, if (text.isNullOrBlank()) "empty_result" else null)
                    }
                    override fun onError(error: Int) {
                        notifyInputResult(session, null, "android_speech_error_$error")
                    }
                    override fun onReadyForSpeech(params: android.os.Bundle?) = Unit
                    override fun onBeginningOfSpeech() = Unit
                    override fun onRmsChanged(rmsdB: Float) = Unit
                    override fun onBufferReceived(buffer: ByteArray?) = Unit
                    override fun onEndOfSpeech() = Unit
                    override fun onPartialResults(partialResults: android.os.Bundle?) = Unit
                    override fun onEvent(eventType: Int, params: android.os.Bundle?) = Unit
                })
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, if (language.isBlank()) "es-MX" else language)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "es-MX")
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                }
                speechRecognizer?.startListening(intent)
            }
            return session
        }

        @JavascriptInterface
        fun stop(): Boolean {
            runOnUiThread { speechRecognizer?.stopListening() }
            return true
        }
    }

    private inner class NativeVoiceBridge {
        @JavascriptInterface
        fun isAvailable(): Boolean = ttsReady

        @JavascriptInterface
        fun speakAsync(text: String, language: String, rate: Float, pitch: Float): String {
            val id = UUID.randomUUID().toString()
            runOnUiThread {
                if (!ttsReady) {
                    notifyVoiceResult(id, false, "android_tts_unavailable")
                    return@runOnUiThread
                }
                val locale = when {
                    language.equals("es-MX", true) -> Locale("es", "MX")
                    language.startsWith("es", true) -> Locale("es", "ES")
                    else -> Locale.getDefault()
                }
                if (tts?.isLanguageAvailable(locale) ?: -1 >= TextToSpeech.LANG_AVAILABLE) {
                    tts?.language = locale
                }
                tts?.setSpeechRate(rate.coerceIn(0.5f, 2.0f))
                tts?.setPitch(pitch.coerceIn(0.5f, 2.0f))
                if (tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) == TextToSpeech.ERROR) {
                    notifyVoiceResult(id, false, "android_tts_rejected")
                }
            }
            return id
        }

        @JavascriptInterface
        fun stop(): Boolean {
            tts?.stop()
            return true
        }
    }

    override fun onDestroy() {
        tts?.stop()
        tts?.shutdown()
        webView.removeJavascriptInterface("WAE_NATIVE_VOICE")
        webView.removeJavascriptInterface("WAE_NATIVE_VOICE_INPUT")
        speechRecognizer?.destroy()
        speechRecognizer = null
        webView.destroy()
        super.onDestroy()
    }

    @Deprecated("Deprecated in Android API 33")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
