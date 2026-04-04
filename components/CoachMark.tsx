import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Dimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Feather } from './VectorIcons';

const { height: SCREEN_H } = Dimensions.get('window');

export interface CoachMarkStep {
  id?: string;
  target: { x: number; y: number; width: number; height: number };
  title: string;
  description: string;
  position: 'above' | 'below';
}

interface CoachMarkOverlayProps {
  steps: CoachMarkStep[];
  visible: boolean;
  onComplete: () => void;
}

const CoachMarkOverlay: React.FC<CoachMarkOverlayProps> = ({ steps, visible, onComplete }) => {
  const [currentStep, setCurrentStep] = React.useState(0);

  if (!visible || steps.length === 0) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
      setCurrentStep(0);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSkip = () => {
    onComplete();
    setCurrentStep(0);
  };

  const tooltipHeight = 130;
  let tooltipTop = step.position === 'above'
    ? step.target.y - tooltipHeight - 8
    : step.target.y + step.target.height + 16;

  if (tooltipTop < 40) tooltipTop = step.target.y + step.target.height + 16;
  if (tooltipTop + tooltipHeight > SCREEN_H - 40) tooltipTop = step.target.y - tooltipHeight - 8;

  tooltipTop = Math.max(40, Math.min(tooltipTop, SCREEN_H - tooltipHeight - 40));

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.dimArea, { top: 0, left: 0, right: 0, height: Math.max(0, step.target.y - 8) }]} />
        <View style={[styles.dimArea, {
          top: step.target.y + step.target.height + 8,
          left: 0, right: 0, bottom: 0,
        }]} />
        <View style={[styles.dimArea, {
          top: step.target.y - 8,
          left: 0,
          width: Math.max(0, step.target.x - 8),
          height: step.target.height + 16,
        }]} />
        <View style={[styles.dimArea, {
          top: step.target.y - 8,
          right: 0,
          left: step.target.x + step.target.width + 8,
          height: step.target.height + 16,
        }]} />

        <View style={[styles.spotlight, {
          top: step.target.y - 8,
          left: step.target.x - 8,
          width: step.target.width + 16,
          height: step.target.height + 16,
        }]} />

        <Animated.View
          key={currentStep}
          entering={FadeIn.duration(200)}
          style={[styles.tooltip, {
            top: tooltipTop,
            left: 20,
            right: 20,
          }]}
        >
          <Text style={styles.tooltipTitle}>{step.title}</Text>
          <Text style={styles.tooltipDesc}>{step.description}</Text>

          <View style={styles.tooltipFooter}>
            <View style={styles.dots}>
              {steps.map((_, i) => (
                <View key={i} style={[styles.dot, i === currentStep && styles.dotActive]} />
              ))}
            </View>

            <View style={styles.tooltipButtons}>
              <Pressable onPress={handleSkip} hitSlop={8}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
              <Pressable style={styles.nextBtn} onPress={handleNext}>
                <Text style={styles.nextText}>{isLast ? 'Got it!' : 'Next'}</Text>
                {!isLast ? <Feather name="arrow-right" size={14} color="#fff" /> : null}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    position: 'relative',
  },
  dimArea: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  spotlight: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ff6b5b',
    backgroundColor: 'transparent',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,107,91,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  tooltipDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 19,
    marginBottom: 16,
  },
  tooltipFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotActive: {
    backgroundColor: '#ff6b5b',
    width: 18,
  },
  tooltipButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  skipText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ff6b5b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  nextText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});

export default CoachMarkOverlay;
