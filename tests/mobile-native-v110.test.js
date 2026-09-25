import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('v112 mobile brain uses native server first and retains governed fallback',async()=>{
  const [brain,premium]=await Promise.all([read('mobile-brain-v110.js'),read('premium-v5.js')]);
  assert.match(brain,/interface-brain\/v112-server-first/);
  assert.match(brain,/xhr\.open\('POST','\/api\/native-brain\/chat'/);
  assert.match(brain,/primary:'xhr:\/api\/native-brain\/chat'/);
  assert.match(brain,/fallback:'original governed route'/);
  assert.match(brain,/web_enabled:body\.web_enabled===true\|\|mode==='research'/);
  assert.match(brain,/responseStyle:'premium-rich'/);
  assert.match(brain,/attachments:Array\.isArray\(body\.attachments\)/);
  assert.match(brain,/return priorFetch\(input,bypassInit\(init,body\)\)/);
  assert.match(premium,/mobile-brain-v110\.js\?v=110/);
  assert.match(premium,/loadUniversalBrain\(\)/);
  assert.doesNotMatch(premium,/reference-interface-v108/);
});

test('Android shell targets the current Google Play API baseline and preserves canonical production UI',async()=>{
  const [gradle,manifest,activity,workflow]=await Promise.all([
    read('android/app/build.gradle.kts'),
    read('android/app/src/main/AndroidManifest.xml'),
    read('android/app/src/main/java/com/waeos/universalcore/MainActivity.java'),
    read('.github/workflows/android-universal-core.yml')
  ]);
  assert.match(gradle,/applicationId = "com\.waeos\.universalcore"/);
  assert.match(gradle,/compileSdk = 36/);
  assert.match(gradle,/targetSdk = 36/);
  assert.match(manifest,/android\.permission\.INTERNET/);
  assert.match(manifest,/android\.permission\.RECORD_AUDIO/);
  assert.match(manifest,/android:usesCleartextTraffic="false"/);
  assert.match(activity,/https:\/\/wae-inteligencia-universal-vt3h\.onrender\.com\/\?native=android&source=app/);
  assert.match(activity,/setMixedContentMode\(WebSettings\.MIXED_CONTENT_NEVER_ALLOW\)/);
  assert.match(activity,/setAllowFileAccess\(false\)/);
  assert.match(activity,/PermissionRequest\.RESOURCE_AUDIO_CAPTURE/);
  assert.match(activity,/handler\.cancel\(\)/);
  assert.match(workflow,/:app:assembleDebug :app:bundleRelease/);
  assert.match(workflow,/platforms;android-36/);
});
