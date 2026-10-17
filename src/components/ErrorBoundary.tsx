import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FairPathColors as C, FairPathFonts as F } from '@/constants/fairpath';
import { captureException } from '@/core/observability/error-monitor';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Root-level render-error boundary. Before this existed, any uncaught render error anywhere in the app crashed
 * to a blank screen with zero reporting -- src/core/observability/error-monitor.ts was fully built (sanitized
 * context, provider-neutral adapter) but had zero call sites anywhere in the app. This is what finally wires it
 * in, plus gives a real person a real "something went wrong" screen instead of a blank one.
 * Deliberately a class component: componentDidCatch has no hook equivalent.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureException(error, { componentStack: info.componentStack ?? undefined });
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={s.screen}>
        <Text style={s.title}>Something went wrong</Text>
        <Text style={s.body}>FairPath hit an unexpected error. It's been logged. Try again, or close and reopen the app.</Text>
        <Pressable accessibilityRole="button" style={s.button} onPress={this.reset}>
          <Text style={s.buttonText}>TRY AGAIN</Text>
        </Pressable>
      </View>
    );
  }
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: C.white, fontFamily: F.black, fontSize: 22, textAlign: 'center' },
  body: { color: C.mutedStrong, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 10, maxWidth: 340 },
  button: { height: 48, paddingHorizontal: 24, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  buttonText: { color: C.black, fontFamily: F.extraBold, fontSize: 10, letterSpacing: 0.8 },
});
