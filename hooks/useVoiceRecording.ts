import { useState, useRef, useCallback } from 'react';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';
import * as Haptics from 'expo-haptics';

export function useVoiceRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const startRecording = useCallback(async () => {
    try {
      const { requestRecordingPermissionsAsync } = await import('expo-audio');
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) return null;

      const { setAudioModeAsync } = await import('expo-audio');
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();

      setIsRecording(true);
      setRecordingDuration(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      return recorder;
    } catch (err) {
      console.error('Failed to start recording:', err);
      return null;
    }
  }, [recorder]);

  const stopRecording = useCallback(async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const duration = recordingDuration * 1000;

      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
      setRecordingDuration(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      return { uri, durationMs: duration };
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setIsRecording(false);
      return null;
    }
  }, [recorder, recordingDuration]);

  const cancelRecording = useCallback(async () => {
    try {
      await recorder.stop();
    } catch {}
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setRecordingDuration(0);
  }, [recorder]);

  return { isRecording, recordingDuration, startRecording, stopRecording, cancelRecording };
}
