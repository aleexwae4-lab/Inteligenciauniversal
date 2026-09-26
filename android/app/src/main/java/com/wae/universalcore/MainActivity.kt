package com.wae.universalcore

import android.app.Activity
import android.os.Bundle
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

    companion object {
        private const val START_URL =
            "https://wae-inteligencia-universal-vt3h.onrender.com/?source=android-native"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)
        configureWebView()
        initTts()
        webView.loadUrl(START_URL)
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
        webView.destroy()
        super.onDestroy()
    }

    @Deprecated("Deprecated in Android API 33")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
