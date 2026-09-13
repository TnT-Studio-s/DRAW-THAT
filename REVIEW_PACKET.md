# Focused review packet: Android edge gesture closes an active room

Date: 2026-09-12

Status: BLOCKED after two evidence-based native fix/test cycles. The ineffective experiments were removed. The independent live-drawing repair and bidirectional browser regression remain in place.

## User-visible failure

On the Samsung S25 Ultra, the app returned to the Android launcher when the phone became the drawer after the preceding turn was failed. Reopening Draw Duo returned to the lobby and the live room was lost.

## Confirmed evidence

The Draw Duo process remained alive and no `FATAL EXCEPTION`, Java crash, WebView renderer crash, or server error was recorded. Android activity logs instead showed this sequence:

1. `InputDispatcher`: the `[Gesture Monitor] edge-swipe` stole input from `com.drawduo.playtest.MainActivity`.
2. `WindowManager`: Android created a `PREDICTIVE_BACK` transition.
3. `ActivityClientController.finishActivity` closed `MainActivity`.
4. Samsung Launcher became `topResumedActivity` and Draw Duo was frozen in the background.

The failure was reproduced independently with `adb shell input keyevent 4` while a real private room was active. Before Back, the phone displayed a valid six-character invite. After Back, Samsung Launcher was foreground and the invite was gone.

## What is not failing

`tests/e2e/live-drawing.spec.ts` uses two isolated browser contexts and now covers both directions across a role swap. It creates and joins a real private room, readies both players, draws from the first active drawer, verifies nonwhite pixels on the remote canvas, passes the turn, selects the next prompt on the former guesser, draws in the reverse direction, and verifies pixels on the former drawer. That focused test passed.

The server room, role alternation, prompt selection, remote stroke broadcast, remote canvas rendering, and guess/pass transition are therefore not implicated by current evidence.

## Repair cycles attempted

Cycle 1 added an AndroidX `OnBackPressedCallback` in `MainActivity` and marked active React sessions in the document. The APK compiled, installed, launched, and created a room, but a real Back action still finished the activity.

Cycle 2 additionally set `android:enableOnBackInvokedCallback="false"` on `MainActivity` to route Android 15 away from predictive Back. The APK again compiled, installed, launched, and created a room, but the same physical-device check still finished the activity.

Both ineffective experiments were removed rather than leaving dead lifecycle code in the application.

## Safe temporary workaround

Avoid beginning drawing gestures at the extreme left or right screen edge on Android. Start the stroke slightly inside the white drawing board. The visible Settings menu remains the intended way to leave an active game.

## Recommended focused follow-up

Instrument the native activity and Capacitor bridge to establish which Back dispatcher receives the event on this Android 15/Samsung build. Review Capacitor 8's current Back handling before choosing between explicit `OnBackInvokedDispatcher` registration, a Capacitor App back-button listener, or a canvas-specific system-gesture exclusion strategy. Do not attempt another lifecycle rewrite without first proving the callback path in device logs.

## Exact reproduction commands

```powershell
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
npm run build:android:debug
npm run test:android
& "$env:ANDROID_HOME\platform-tools\adb.exe" reverse tcp:2567 tcp:2567
$adb="$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb shell input keyevent 4
& $adb shell dumpsys activity activities | Select-String 'topResumedActivity'
& $adb logcat -d -v brief ActivityTaskManager:V WindowManager:V InputDispatcher:V AndroidRuntime:E '*:S'
```

Expected acceptance result: Back or an intercepted edge gesture during a live room must not finish `MainActivity`, move the launcher to the foreground, or disconnect the room. Lobby Back behavior must remain intentionally defined and separately tested.
