import { forwardRef, useEffect, type ReactNode, type RefObject } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';

/**
 * The ONE keyboard strategy for every screen with text inputs.
 *
 * iOS: `automaticallyAdjustKeyboardInsets` lets the native scroll view add a bottom inset equal to
 * however much of ITS OWN frame the keyboard covers, and scroll the focused input into view. Because it
 * is computed from the scroll view's frame, the persistent FairPath bottom nav (which sits below the
 * scroll view inside ScreenFrame) and the safe-area inset are accounted for automatically, so the last
 * field, its validation message and the bottom action button can all be scrolled above the keyboard,
 * and multiline fields stay visible while typing.
 * Android: the window resizes for the keyboard, so nothing extra is needed.
 *
 * Do NOT add KeyboardAvoidingView, manual keyboard-height offsets or position:'absolute' bottom CTAs
 * around this; stacking keyboard hacks makes them fight each other (scripts/audit-keyboard.mjs enforces it).
 */
export const KEYBOARD_LIST_PROPS={
 automaticallyAdjustKeyboardInsets:true,
 keyboardShouldPersistTaps:'handled',
 keyboardDismissMode:Platform.OS==='ios'?'interactive':'on-drag'
} as const;

/** Scroll props for fixed-footer chat screens (composer outside scroll). Do not stack with automaticallyAdjustKeyboardInsets. */
export const FOOTER_SCROLL_PROPS={
 keyboardShouldPersistTaps:'handled',
 keyboardDismissMode:Platform.OS==='ios'?'interactive':'on-drag'
} as const;

export type FormScrollViewProps=ScrollViewProps&{/** When true, omit iOS keyboard insets (use with KeyboardFooterLayout). */footerScroll?:boolean};

/** Drop-in ScrollView for forms. Taps on empty space dismiss the keyboard; taps on buttons still work. */
export const FormScrollView=forwardRef<ScrollView,FormScrollViewProps>(function FormScrollView({footerScroll,...props},ref){
 const kb=footerScroll?FOOTER_SCROLL_PROPS:KEYBOARD_LIST_PROPS;
 return <ScrollView ref={ref} {...kb} {...props}/>;
});

/**
 * ONLY for screens whose primary button lives in a fixed footer OUTSIDE the scroll view (profile setup,
 * onboarding). Lifts that footer above the iOS keyboard. Because the container shrinks, the FormScrollView
 * inside no longer overlaps the keyboard, so the two mechanisms never both apply. Screens whose button is
 * inside the scroll content need only FormScrollView.
 */
export function KeyboardFooterLayout({
 children,
 chatScrollRef,
}:{children:ReactNode;/** Keeps latest chat messages visible when the iOS keyboard opens. */chatScrollRef?:RefObject<ScrollView|null>}){
 useEffect(()=>{
  if(Platform.OS!=='ios'||!chatScrollRef)return;
  const show=Keyboard.addListener('keyboardWillShow',()=>{
   requestAnimationFrame(()=>chatScrollRef.current?.scrollToEnd({animated:true}));
  });
  return ()=>show.remove();
 },[chatScrollRef]);
 return <KeyboardAvoidingView style={layout.fill} behavior={Platform.OS==='ios'?'padding':undefined}>{children}</KeyboardAvoidingView>;
}
const layout=StyleSheet.create({fill:{flex:1}});
