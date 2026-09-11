import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')

describe('Phase 6 release packaging contracts', () => {
  it('requires runtime backend configuration for packaged Windows builds', () => {
    expect(read('apps/desktop/src/main.mjs')).toContain('runtime_config_missing')
    expect(read('apps/desktop/forge.config.cjs')).toContain('draw-duo-runtime.json')
    expect(read('scripts/build-windows.js')).toContain('--release')
    expect(read('scripts/build-windows.js')).toContain('must_use_production_tls')
  })

  it('requires signed Android release configuration and produces an app bundle', () => {
    const script = read('scripts/android.js')
    const gradle = read('apps/mobile/android/app/build.gradle')
    expect(script).toContain('bundleRelease')
    expect(script).toContain('DRAW_DUO_ANDROID_KEYSTORE_PATH')
    expect(gradle).toContain('DRAW_DUO_ANDROID_KEY_ALIAS')
    expect(gradle).toContain('GradleException')
  })

  it('keeps monetization disabled and release evidence explicit', () => {
    expect(read('apps/mobile/package.json')).not.toMatch(/admob|billingclient|rewarded/i)
    expect(read('apps/desktop/package.json')).not.toMatch(/admob|billingclient|rewarded/i)
    expect(read('scripts/release-check.js')).toContain('ready_for_owner_review')
    expect(read('scripts/release-manifest.js')).toContain('sha256')
  })
})
