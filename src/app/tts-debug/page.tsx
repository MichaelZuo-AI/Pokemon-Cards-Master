'use client';

import { useState } from 'react';

interface LogEntry {
  time: string;
  level: 'info' | 'error' | 'success';
  message: string;
}

export default function TTSDebugPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [testing, setTesting] = useState(false);

  function log(level: LogEntry['level'], message: string) {
    setLogs((prev) => [
      ...prev,
      { time: new Date().toLocaleTimeString(), level, message },
    ]);
  }

  async function testTTSAPI() {
    log('info', '--- Test 1: TTS API ---');
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Source': 'pokemon-cards-master',
        },
        body: JSON.stringify({ text: '你好，这是语音测试' }),
      });

      log('info', `Response status: ${res.status}`);
      log('info', `Content-Type: ${res.headers.get('Content-Type')}`);

      if (!res.ok) {
        const err = await res.json();
        log('error', `API error: ${JSON.stringify(err)}`);
        return null;
      }

      const blob = await res.blob();
      log('info', `Blob size: ${blob.size} bytes, type: ${blob.type}`);

      if (blob.size === 0) {
        log('error', 'Empty blob received!');
        return null;
      }

      log('success', 'TTS API returned valid audio');
      return blob;
    } catch (err) {
      log('error', `Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  async function testAudioPlayback(blob: Blob) {
    log('info', '--- Test 2: Audio Playback ---');
    try {
      const url = URL.createObjectURL(blob);
      log('info', `Object URL created: ${url.substring(0, 30)}...`);

      const audio = new Audio();
      audio.src = url;

      log('info', 'Calling audio.play()...');
      await audio.play();
      log('success', 'audio.play() resolved! Audio should be playing.');

      await new Promise<void>((resolve) => {
        audio.onended = () => {
          log('success', 'Audio playback completed (onended fired)');
          resolve();
        };
        audio.onerror = () => {
          log('error', `Audio playback error: ${audio.error?.message || 'unknown'}`);
          resolve();
        };
        // Safety timeout
        setTimeout(() => {
          log('info', 'Audio timeout after 10s (may still be playing)');
          resolve();
        }, 10000);
      });

      URL.revokeObjectURL(url);
    } catch (err) {
      log('error', `Audio play failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function testPreCreatedAudio(blob: Blob) {
    log('info', '--- Test 3: Pre-created Audio (mobile pattern) ---');
    try {
      // This mimics the hook pattern: create Audio first, set src later
      const audio = new Audio();
      log('info', 'Audio element pre-created');

      const url = URL.createObjectURL(blob);
      audio.src = url;

      log('info', 'Calling audio.play() on pre-created element...');
      await audio.play();
      log('success', 'Pre-created audio.play() resolved!');

      audio.pause();
      URL.revokeObjectURL(url);
    } catch (err) {
      log('error', `Pre-created audio play failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function testBrowserTTS() {
    log('info', '--- Test 4: Browser SpeechSynthesis ---');

    if (!('speechSynthesis' in window)) {
      log('error', 'speechSynthesis not available!');
      return;
    }

    const voices = window.speechSynthesis.getVoices();
    log('info', `Total voices: ${voices.length}`);

    const zhVoices = voices.filter((v) => v.lang.startsWith('zh'));
    log('info', `Chinese voices: ${zhVoices.length}`);
    zhVoices.forEach((v) => {
      log('info', `  - ${v.name} (${v.lang}, local=${v.localService})`);
    });

    if (voices.length === 0) {
      log('info', 'No voices loaded yet — trying after delay...');
      await new Promise((r) => setTimeout(r, 500));
      const retryVoices = window.speechSynthesis.getVoices();
      log('info', `Voices after delay: ${retryVoices.length}`);
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance('你好，这是浏览器语音测试');
      utterance.lang = 'zh-CN';
      utterance.rate = 0.85;
      utterance.pitch = 1.15;

      const zhVoice =
        voices.find((v) => v.lang === 'zh-CN' && !v.localService) ||
        voices.find((v) => v.lang === 'zh-CN') ||
        voices.find((v) => v.lang.startsWith('zh'));

      if (zhVoice) {
        utterance.voice = zhVoice;
        log('info', `Selected voice: ${zhVoice.name} (${zhVoice.lang})`);
      } else {
        log('info', 'No Chinese voice found, using default');
      }

      utterance.onstart = () => log('success', 'Browser TTS started speaking');
      utterance.onend = () => log('success', 'Browser TTS finished');
      utterance.onerror = (e) => log('error', `Browser TTS error: ${e.error}`);

      window.speechSynthesis.speak(utterance);
      log('info', 'speechSynthesis.speak() called');
    } catch (err) {
      log('error', `Browser TTS failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function testFullPipeline() {
    log('info', '--- Test 5: Full Pipeline (mimics hook) ---');
    try {
      // Step 1: Pre-create audio (in user gesture)
      const audio = new Audio();
      log('info', 'Step 1: Audio pre-created in click handler');

      audio.onended = () => log('success', 'Pipeline: audio ended');
      audio.onerror = () => log('error', `Pipeline: audio error: ${audio.error?.message}`);

      // Step 2: Fetch TTS (async — may lose gesture context)
      log('info', 'Step 2: Fetching TTS API...');
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Source': 'pokemon-cards-master',
        },
        body: JSON.stringify({ text: '这是完整流程测试，模拟实际使用场景' }),
      });

      if (!res.ok) {
        log('error', `Pipeline: API returned ${res.status}`);
        log('info', 'Pipeline: Falling back to browser TTS...');
        testBrowserTTS();
        return;
      }

      const blob = await res.blob();
      log('info', `Step 3: Got blob ${blob.size} bytes`);

      if (blob.size === 0) {
        log('error', 'Pipeline: Empty blob');
        return;
      }

      const url = URL.createObjectURL(blob);
      audio.src = url;
      log('info', 'Step 4: Set audio.src, calling play()...');

      await audio.play();
      log('success', 'Step 5: audio.play() resolved — playing!');
    } catch (err) {
      log('error', `Pipeline failed: ${err instanceof Error ? err.message : String(err)}`);
      log('info', 'Pipeline: Attempting browser TTS fallback...');
      testBrowserTTS();
    }
  }

  async function runAllTests() {
    setLogs([]);
    setTesting(true);

    // Test 1: API
    const blob = await testTTSAPI();

    // Test 2 & 3: Audio playback (only if API returned audio)
    if (blob) {
      await testAudioPlayback(blob);
      await testPreCreatedAudio(blob);
    }

    // Test 4: Browser TTS
    await testBrowserTTS();

    setTesting(false);
  }

  const levelColors: Record<string, string> = {
    info: 'text-gray-300',
    error: 'text-red-400',
    success: 'text-green-400',
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">TTS Debug</h1>

      <div className="space-y-3 mb-6">
        <button
          onClick={runAllTests}
          disabled={testing}
          className="w-full py-3 bg-blue-600 rounded-lg font-medium disabled:opacity-50"
        >
          {testing ? 'Testing...' : 'Run All Tests'}
        </button>

        <button
          onClick={testFullPipeline}
          disabled={testing}
          className="w-full py-3 bg-purple-600 rounded-lg font-medium disabled:opacity-50"
        >
          Test Full Pipeline (like real usage)
        </button>

        <button
          onClick={testBrowserTTS}
          disabled={testing}
          className="w-full py-3 bg-green-600 rounded-lg font-medium disabled:opacity-50"
        >
          Test Browser TTS Only
        </button>
      </div>

      <div className="bg-gray-900 rounded-lg p-3 space-y-1 font-mono text-xs overflow-auto max-h-[60vh]">
        {logs.length === 0 && (
          <p className="text-gray-500">Press a button to start testing...</p>
        )}
        {logs.map((entry, i) => (
          <div key={i} className={levelColors[entry.level]}>
            <span className="text-gray-600">[{entry.time}]</span> {entry.message}
          </div>
        ))}
      </div>
    </div>
  );
}
