import { Text, View } from 'react-native';
import { FairPathFonts as F } from '@/constants/fairpath';
import type { DocBlock } from '@/core/documents/spec';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { StyleSheet } from 'react-native';

/**
 * The member-facing preview of a DocumentSpec. It renders the SAME blocks the PDF/DOCX renderers draw, so what the
 * member reviews here is exactly what is exported (tables become stacked rows so they read well on a phone).
 */
export function SpecPreview({ title, blocks, footer }: { title: string; blocks: DocBlock[]; footer: string }) {
  const s = useThemedStyles(styles);
  return (
    <View style={s.sheet} accessibilityLabel={`Preview of ${title}`}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading':
            return <Text key={i} style={b.level === 2 ? s.h2 : b.level === 3 ? s.h3 : s.h1}>{b.text}</Text>;
          case 'paragraph':
            return <Text key={i} style={s.p}>{b.text}</Text>;
          case 'notice':
            return <View key={i} style={[s.notice, b.tone === 'warning' && s.noticeWarn]}><Text style={s.noticeText}>{b.text}</Text></View>;
          case 'keyvalue':
            return (
              <View key={i} style={s.kvBlock}>
                {b.items.map((it, k) => (
                  <View key={k} style={s.kv}>
                    <Text style={s.kvLabel}>{it.label.toUpperCase()}</Text>
                    <Text style={s.kvValue}>{it.value}</Text>
                  </View>
                ))}
              </View>
            );
          case 'bullets':
            return <View key={i}>{b.items.map((t, k) => <Text key={k} style={s.bullet}>• {t}</Text>)}</View>;
          case 'checklist':
            return (
              <View key={i}>
                {b.items.map((it, k) => (
                  <View key={k} style={s.check}>
                    <View style={[s.box, it.checked && s.boxOn]} />
                    <View style={s.checkCopy}>
                      <Text style={s.p}>{it.text}</Text>
                      {it.note ? <Text style={s.note}>{it.note}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            );
          case 'editable':
            return (
              <View key={i} style={s.kvBlock}>
                <Text style={s.kvLabel}>{b.label.toUpperCase()}</Text>
                <View style={s.editBox}><Text style={s.p}>{b.value || ' '}</Text></View>
                {b.hint ? <Text style={s.note}>{b.hint}</Text> : null}
              </View>
            );
          case 'table':
            return (
              <View key={i}>
                {b.rows.map((row, r) => (
                  <View key={r} style={s.rowCard}>
                    <Text style={s.rowTitle}>{row[0]}</Text>
                    {row.slice(1).map((cell, c) => (cell ? <Text key={c} style={s.rowLine}><Text style={s.rowKey}>{b.columns[c + 1]}: </Text>{cell}</Text> : null))}
                  </View>
                ))}
              </View>
            );
          case 'spacer':
            return <View key={i} style={{ height: 10 }} />;
        }
      })}
      <Text style={s.footer}>{footer}</Text>
    </View>
  );
}

const styles = (t: ThemeTokens) => StyleSheet.create({
  sheet: { borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, padding: 16, marginTop: 12 },
  h1: { color: t.text, fontFamily: F.black, fontSize: 22, lineHeight: 26, marginBottom: 6 },
  h2: { color: t.text, fontFamily: F.extraBold, fontSize: 15, marginTop: 16, marginBottom: 6 },
  h3: { color: t.text, fontFamily: F.bold, fontSize: 13, marginTop: 10, marginBottom: 4 },
  p: { color: t.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  bullet: { color: t.textSecondary, fontSize: 13, lineHeight: 19 },
  note: { color: t.textMuted, fontSize: 11, lineHeight: 16 },
  notice: { borderLeftWidth: 3, borderLeftColor: t.accent, backgroundColor: t.surfaceRaised, padding: 10, marginVertical: 8 },
  noticeWarn: { borderLeftColor: t.warning },
  noticeText: { color: t.textSecondary, fontSize: 12, lineHeight: 17 },
  kvBlock: { marginVertical: 4 },
  kv: { marginBottom: 6 },
  kvLabel: { color: t.textMuted, fontFamily: F.extraBold, fontSize: 9, letterSpacing: 1 },
  kvValue: { color: t.text, fontSize: 13, lineHeight: 18 },
  check: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  box: { width: 14, height: 14, borderWidth: 1, borderColor: t.text, marginTop: 3 },
  boxOn: { backgroundColor: t.accent },
  checkCopy: { flex: 1 },
  editBox: { borderWidth: 1, borderColor: t.borderStrong, padding: 8, marginTop: 4 },
  rowCard: { borderTopWidth: 1, borderTopColor: t.border, paddingVertical: 8 },
  rowTitle: { color: t.text, fontFamily: F.extraBold, fontSize: 13 },
  rowLine: { color: t.textSecondary, fontSize: 12, lineHeight: 17 },
  rowKey: { color: t.textMuted, fontFamily: F.bold },
  footer: { color: t.textMuted, fontSize: 10, lineHeight: 15, marginTop: 16, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 8 },
});
