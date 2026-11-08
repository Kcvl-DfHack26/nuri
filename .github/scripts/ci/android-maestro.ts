import { $ } from 'bun';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const runnerTemp = Bun.env.RUNNER_TEMP;
const androidSdk = Bun.env.ANDROID_HOME;
if (!runnerTemp || !androidSdk) {
  throw new Error('RUNNER_TEMP and ANDROID_HOME are required');
}

const tools = join(runnerTemp, 'maestro-android');
await mkdir(tools, { recursive: true });

const commandLineTools = join(androidSdk, 'cmdline-tools', 'latest', 'bin');
const emulatorBinary = join(androidSdk, 'emulator', 'emulator');
const adb = join(androidSdk, 'platform-tools', 'adb');
const systemImage = 'system-images;android-34;aosp_atd;x86_64';
const avd = 'nuri-maestro';
const avdHome = join(tools, 'avd');
const emulatorEnv = { ...Bun.env, ANDROID_AVD_HOME: avdHome };
const metroUrl = 'http://127.0.0.1:8081';
const expoGo = 'Expo-Go-58.0.5.apk';
let emulator: ReturnType<typeof Bun.spawn> | undefined;
let metro: ReturnType<typeof Bun.spawn> | undefined;

async function download(repo: string, release: string, asset: string, digest: string) {
  await $`gh release download ${release} --repo ${repo} --pattern ${asset} --dir ${tools}`;
  const path = join(tools, asset);
  const sha = new Bun.CryptoHasher('sha256')
    .update(await Bun.file(path).arrayBuffer())
    .digest('hex');
  if (sha !== digest) {
    throw new Error(`Unexpected SHA-256 for ${asset}`);
  }
}

async function prepareEmulator() {
  console.time('Android setup and boot');
  await $`sudo chmod a+rw /dev/kvm`;
  await $`${join(commandLineTools, 'sdkmanager')} --install emulator ${systemImage}`;
  await mkdir(avdHome, { recursive: true });
  await $`printf 'no\\n' | ${join(commandLineTools, 'avdmanager')} create avd --name ${avd} --package ${systemImage} --device pixel_2`.env(
    emulatorEnv,
  );
  if (!(await Bun.file(join(avdHome, `${avd}.ini`)).exists())) {
    throw new Error('Android Virtual Device was not created');
  }
  emulator = Bun.spawn(
    [
      emulatorBinary,
      '-avd',
      avd,
      '-no-window',
      '-no-boot-anim',
      '-no-audio',
      '-no-snapshot',
      '-gpu',
      'swiftshader_indirect',
    ],
    { env: emulatorEnv, stdout: 'inherit', stderr: 'inherit' },
  );

  for (;;) {
    if (emulator.exitCode !== null) {
      throw new Error(`Android emulator exited before boot: ${emulator.exitCode}`);
    }
    const boot = await $`${adb} shell getprop sys.boot_completed`.quiet().nothrow();
    if (boot.text().trim() === '1') {
      break;
    }
    await Bun.sleep(1000);
  }
  await $`${adb} shell settings put global window_animation_scale 0`;
  await $`${adb} shell settings put global transition_animation_scale 0`;
  await $`${adb} shell settings put global animator_duration_scale 0`;
  console.timeEnd('Android setup and boot');
}

async function prepareMetro() {
  console.time('Dependencies and Metro');
  await $`bun install --frozen-lockfile`;
  metro = Bun.spawn(
    [
      'bun',
      'run',
      '--bun',
      '--cwd',
      'apps/mobile',
      'expo',
      'start',
      '--go',
      '--localhost',
      '--no-dev',
      '--max-workers',
      '2',
    ],
    {
      env: {
        ...Bun.env,
        EXPO_NO_METRO_LAZY: '1',
        EXPO_NO_TELEMETRY: '1',
        EXPO_OFFLINE: '1',
      },
      stdout: 'inherit',
      stderr: 'inherit',
    },
  );
  for (;;) {
    const response = await fetch(`${metroUrl}/status`).catch(() => null);
    if (response?.ok) {
      await response.text();
      break;
    }
    if (metro.exitCode !== null) {
      throw new Error('Metro stopped before startup');
    }
    await Bun.sleep(500);
  }
  // エミュレーターの起動中に、最初のAndroidバンドルを生成しておく。
  const response = await fetch(metroUrl, {
    headers: { 'Expo-Platform': 'android', Accept: 'application/expo+json' },
  });
  if (!response.ok) {
    throw new Error(`Metro manifest failed: HTTP ${response.status}`);
  }
  const manifest: unknown = await response.json();
  if (!manifest || typeof manifest !== 'object' || !('launchAsset' in manifest)) {
    throw new Error('Metro manifest is missing its launch asset');
  }
  const launchAsset = manifest.launchAsset;
  if (
    !launchAsset ||
    typeof launchAsset !== 'object' ||
    !('url' in launchAsset) ||
    typeof launchAsset.url !== 'string'
  ) {
    throw new Error('Metro manifest is missing its bundle URL');
  }
  const bundle = await fetch(launchAsset.url);
  if (!bundle.ok) {
    throw new Error(`Metro bundle failed: HTTP ${bundle.status}`);
  }
  await bundle.arrayBuffer();
  console.timeEnd('Dependencies and Metro');
}

async function prepareMaestro() {
  await download(
    'mobile-dev-inc/Maestro',
    'cli-2.12.1',
    'maestro.zip',
    '54dbb0716425626604973cbb374c585ca30272375d9ce15177a1152765ddd9d7',
  );
  await $`unzip -q ${join(tools, 'maestro.zip')} -d ${tools}`;
}

try {
  await Promise.all([
    prepareEmulator(),
    prepareMetro(),
    prepareMaestro(),
    download(
      'expo/expo-go-releases',
      'Expo-Go-58.0.5',
      expoGo,
      'd979cf81c56c5432c5aa69adc9497521ee72d1f87e92eee33bc949167a40f1a6',
    ),
  ]);
  await $`${adb} install ${join(tools, expoGo)}`;
  await $`${adb} reverse tcp:8081 tcp:8081`;
  await $`${join(tools, 'maestro', 'bin', 'maestro')} test apps/mobile/.maestro/expo-go-android.yaml --debug-output .artifacts/maestro`;
} finally {
  metro?.kill();
  emulator?.kill();
}
