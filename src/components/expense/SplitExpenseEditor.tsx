import type { SplitFriend } from '@/types/splitFriend';
import React, { Dispatch, SetStateAction, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Icon } from 'react-native-paper';
import { SplitFriendPickerStrip } from './SplitFriendPickerStrip';

/** Draft row used by add/edit expense screens */
export type SplitParticipantDraft = {
  id: string;
  name: string;
  amount: number;
  email?: string;
  details?: string;
  color: string;
  friendId?: string;
};

type Palette = {
  text: string;
  muted: string;
  line: string;
  surface: string;
  primary: string;
  background: string;
  inputBg: string;
  danger: string;
};

type Props = {
  palette: Palette;
  themeMode: 'light' | 'dark';
  currencySymbol: string;
  splitFriends: SplitFriend[];

  isSplit: boolean;
  onToggleSplit: (v: boolean) => void;
  splitType: 'equal' | 'custom';
  onSplitType: (t: 'equal' | 'custom') => void;

  participants: SplitParticipantDraft[];
  setParticipants: Dispatch<SetStateAction<SplitParticipantDraft[]>>;

  totalAmt: number;
  equalShare: number;
  remaining: number;

  onPickFriend: (f: SplitFriend) => void;
  onOpenFriends: () => void;
  onAddParticipant: () => void;
  onRemoveParticipant: (participantId: string) => void;
  onSaveRowAsFriend: (index: number) => void | Promise<void>;
};

const participantLabel = (i: number) => (i === 0 ? 'You' : `Person ${i + 1}`);

// react-doctor-disable-next-line react-doctor/no-giant-component
export function SplitExpenseEditor({
  palette,
  themeMode,
  currencySymbol,
  splitFriends,
  isSplit,
  onToggleSplit,
  splitType,
  onSplitType,
  participants,
  setParticipants,
  totalAmt,
  equalShare,
  remaining,
  onPickFriend,
  onOpenFriends,
  onAddParticipant,
  onRemoveParticipant,
  onSaveRowAsFriend,
}: Props) {
  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
  const styles = useMemo(() => createStyles(palette), [palette]);

  /** Inset surfaces inside the main card — visible band on light, inputBg on dark */
  const insetBg = themeMode === 'dark' ? palette.inputBg : '#F4F5F7';
  const fieldBg = palette.background;

  const customAllocOk = remaining === 0 && totalAmt > 0;

  return (
    <>
      <Text style={[styles.groupLabel, { color: palette.muted }]}>Split expense</Text>
      <View style={[styles.outerCard, { backgroundColor: palette.surface, borderColor: palette.line }]}>
        <View style={styles.togglePad}>
          <View style={[styles.toggleIconBg, { backgroundColor: insetBg }]}>
            <Icon source="account-group-outline" size={26} color={palette.primary} />
          </View>
          <View style={styles.toggleTextCol}>
            <Text style={[styles.toggleTitle, { color: palette.text }]}>Split with others</Text>
            {isSplit ? (
              <Text style={[styles.toggleSub, { color: palette.muted }]} numberOfLines={1}>
                {participants.length} {participants.length === 1 ? 'person' : 'people'}
              </Text>
            ) : null}
          </View>
          <Switch
            value={isSplit}
            onValueChange={onToggleSplit}
            trackColor={{ false: palette.line, true: palette.primary }}
            thumbColor="#fff"
          />
        </View>

        {isSplit ? (
          <>
            <View style={[styles.sepFull, { backgroundColor: palette.line }]} />

            <View style={styles.splitBody}>
              <View style={[styles.splitSegmentRail, { backgroundColor: insetBg, borderColor: palette.line }]}>
                {(['equal', 'custom'] as const).map((t) => {
                  const active = splitType === t;
                  const label = t === 'equal' ? 'Equal' : 'Custom';
                  return (
                    <Pressable
                      key={t}
                      onPress={() => onSplitType(t)}
                      style={[
                        styles.splitSegmentBtn,
                        active
                          ? { backgroundColor: palette.primary }
                          : { backgroundColor: 'transparent' },
                      ]}
                    >
                      <Text
                        style={[styles.splitSegmentTxt, { color: active ? '#FFFFFF' : palette.text }]}
                        numberOfLines={1}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {splitType === 'equal' ? (
                <View style={[styles.summaryPanel, { backgroundColor: insetBg, borderColor: palette.line }]}>
                  {totalAmt > 0 && participants.length ? (
                    <Text style={[styles.summaryOneLine, { color: palette.text }]} numberOfLines={1}>
                      {`${currencySymbol}${equalShare.toFixed(2)} each · ${participants.length} people`}
                    </Text>
                  ) : (
                    <Text style={[styles.summaryOneLineMuted, { color: palette.muted }]} numberOfLines={1}>
                      Needs total amount
                    </Text>
                  )}
                </View>
              ) : totalAmt > 0 ? (
                <View
                  style={[
                    styles.summaryPanel,
                    {
                      backgroundColor: remaining < 0 ? '#FEE2E2' : customAllocOk ? '#D1FAE5' : insetBg,
                      borderColor:
                        remaining < 0 ? '#FECACA' : customAllocOk ? '#A7F3D0' : palette.line,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.summaryOneLine,
                      {
                        color: remaining < 0 ? palette.danger : customAllocOk ? '#047857' : palette.primary,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {remaining === 0
                      ? `${currencySymbol}${totalAmt.toFixed(2)} — balanced`
                      : remaining > 0
                        ? `${currencySymbol}${remaining.toFixed(2)} left of ${currencySymbol}${totalAmt.toFixed(2)}`
                        : `${currencySymbol}${Math.abs(remaining).toFixed(2)} over ${currencySymbol}${totalAmt.toFixed(2)}`}
                  </Text>
                </View>
              ) : (
                <View style={[styles.summaryPanel, { backgroundColor: insetBg, borderColor: palette.line }]}>
                  <Text style={[styles.summaryOneLineMuted, { color: palette.muted }]} numberOfLines={1}>
                    Needs total amount
                  </Text>
                </View>
              )}

              <View style={[styles.sepInBody, { backgroundColor: palette.line }]} />

              <SplitFriendPickerStrip
                friends={splitFriends}
                palette={palette}
                onPickFriend={onPickFriend}
                onOpenFriends={onOpenFriends}
              />

              <View style={[styles.sepInBody, { backgroundColor: palette.line }]} />

              <View style={styles.peopleHeader}>
                <Text style={[styles.blockTitle, { color: palette.text }]}>People</Text>
                <View style={[styles.countPill, { backgroundColor: insetBg, borderColor: palette.line }]}>
                  <Text style={[styles.countPillText, { color: palette.muted }]}>
                    {participants.length}
                  </Text>
                </View>
              </View>

              <View style={styles.personList}>
                {participants.map((p, i) => (
                  <View
                    key={p.id}
                    style={[styles.personCard, { borderColor: palette.line, backgroundColor: fieldBg }]}
                  >
                    <View style={styles.personCardHead}>
                      <View style={[styles.avatar, { backgroundColor: p.color }]}>
                        <Text style={styles.avatarChar}>{(p.name?.[0] || '?').toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                        <Text style={[styles.roleLabel, { color: palette.muted }]}>
                          {participantLabel(i).toUpperCase()}
                        </Text>
                        <TextInput
                          style={[
                            styles.nameField,
                            { color: palette.text, borderColor: palette.line, backgroundColor: insetBg },
                          ]}
                          placeholder={i === 0 ? 'You' : 'Name'}
                          placeholderTextColor={palette.muted}
                          value={p.name}
                          onChangeText={(v) => {
                            setParticipants((prev) =>
                              prev.map((row, idx) => (idx === i ? { ...row, name: v } : row))
                            );
                          }}
                        />
                      </View>
                      {i > 0 ? (
                        <Pressable
                          hitSlop={12}
                          onPress={() => onRemoveParticipant(p.id)}
                          style={[styles.iconBtnCircle, { backgroundColor: insetBg }]}
                        >
                          <Icon source="close" size={20} color={palette.muted} />
                        </Pressable>
                      ) : (
                        <View style={{ width: 40 }} />
                      )}
                    </View>

                    {splitType === 'equal' ? (
                      <View style={[styles.shareBand, { backgroundColor: insetBg, borderColor: palette.line }]}>
                        <Text style={[styles.fieldCaption, { color: palette.muted }]} numberOfLines={1}>
                          Share
                        </Text>
                        <Text style={[styles.shareAmount, { color: palette.primary }]} numberOfLines={1}>
                          {totalAmt > 0 ? `${currencySymbol}${equalShare.toFixed(2)}` : '—'}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.customShareBlock}>
                        <Text style={[styles.fieldCaption, { color: palette.muted }]} numberOfLines={1}>
                          Share
                        </Text>
                        <View
                          style={[
                            styles.amtRow,
                            { borderColor: palette.line, backgroundColor: insetBg },
                          ]}
                        >
                          <Text style={[styles.amtSymbol, { color: palette.text }]}>{currencySymbol}</Text>
                          <TextInput
                            style={[styles.personAmtInput, { color: palette.text }]}
                            placeholder="0.00"
                            placeholderTextColor={palette.muted}
                            keyboardType="decimal-pad"
                            value={p.amount > 0 ? String(p.amount) : ''}
                            onChangeText={(v) => {
                              setParticipants((prev) =>
                                prev.map((row, idx) =>
                                  idx === i ? { ...row, amount: parseFloat(v) || 0 } : row
                                )
                              );
                            }}
                          />
                        </View>
                      </View>
                    )}

                    {i > 0 ? (
                      <View style={styles.contactStack}>
                        {p.friendId ? (
                          <View style={styles.savedTagRow}>
                            <Icon source="account-check-outline" size={16} color={palette.primary} />
                            <Text style={[styles.savedTag, { color: palette.primary }]}>
                              Saved split friend
                            </Text>
                          </View>
                        ) : null}
                        <Text style={[styles.fieldCaption, { color: palette.muted }]}>Email</Text>
                        <TextInput
                          style={[
                            styles.contactField,
                            { color: palette.text, borderColor: palette.line, backgroundColor: insetBg },
                          ]}
                          placeholder="For reminders"
                          placeholderTextColor={palette.muted}
                          value={p.email || ''}
                          onChangeText={(v) => {
                            setParticipants((prev) =>
                              prev.map((row, idx) => (idx === i ? { ...row, email: v } : row))
                            );
                          }}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                        <Text style={[styles.fieldCaption, { color: palette.muted }]}>Note</Text>
                        <TextInput
                          style={[
                            styles.contactField,
                            { color: palette.text, borderColor: palette.line, backgroundColor: insetBg },
                          ]}
                          placeholder="Optional detail"
                          placeholderTextColor={palette.muted}
                          value={p.details || ''}
                          onChangeText={(v) => {
                            setParticipants((prev) =>
                              prev.map((row, idx) => (idx === i ? { ...row, details: v } : row))
                            );
                          }}
                        />
                        {!p.friendId && ((p.name || '').trim() || (p.email || '').trim()) ? (
                          <Pressable onPress={() => void onSaveRowAsFriend(i)} style={styles.saveFriendBtn}>
                            <Text style={[styles.saveFriendTxt, { color: palette.primary }]}>
                              Save as split friend profile
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>

              <Pressable
                onPress={onAddParticipant}
                style={[styles.addPersonBtn, { borderColor: palette.primary, backgroundColor: fieldBg }]}
              >
                <Icon source="plus-circle-outline" size={24} color={palette.primary} />
                <Text style={[styles.addPersonBtnTxt, { color: palette.primary }]}>Add another person</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </View>
    </>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    groupLabel: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      color: palette.muted,
      marginHorizontal: 16,
      marginBottom: 6,
      marginTop: 18,
    },
    outerCard: {
      marginHorizontal: 16,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },
    sepFull: { height: StyleSheet.hairlineWidth },
    sepInBody: { height: StyleSheet.hairlineWidth, marginVertical: 4 },

    togglePad: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 18,
      paddingVertical: 18,
    },
    toggleIconBg: {
      width: 52,
      height: 52,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    toggleTextCol: { flex: 1, minWidth: 0, gap: 4 },
    toggleTitle: { fontSize: 17, fontWeight: '800' },
    toggleSub: { fontSize: 13, fontWeight: '600' },

    splitBody: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 18,
      gap: 10,
    },
    blockTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },

    splitSegmentRail: {
      flexDirection: 'row',
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 3,
      gap: 3,
    },
    splitSegmentBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 36,
    },
    splitSegmentTxt: { fontSize: 13, fontWeight: '800' },

    summaryPanel: {
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    summaryOneLine: { fontSize: 14, fontWeight: '800' },
    summaryOneLineMuted: { fontSize: 13, fontWeight: '600' },

    peopleHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
    countPill: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 5,
      minWidth: 36,
      alignItems: 'center',
    },
    countPillText: { fontSize: 14, fontWeight: '800' },

    personList: { gap: 14 },

    personCard: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 16,
      gap: 14,
    },
    personCardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 22,
      flexShrink: 0,
    },
    avatarChar: { color: '#fff', fontSize: 16, fontWeight: '800' },
    roleLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.85,
      marginBottom: -2,
    },
    nameField: {
      minHeight: 50,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 14,
      fontSize: 17,
      fontWeight: '600',
      paddingVertical: 12,
    },
    iconBtnCircle: {
      marginTop: 22,
      width: 42,
      height: 42,
      borderRadius: 21,
      justifyContent: 'center',
      alignItems: 'center',
    },

    shareBand: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      paddingVertical: 11,
      paddingHorizontal: 12,
    },
    fieldCaption: { fontSize: 12, fontWeight: '700' },
    shareAmount: { fontSize: 17, fontWeight: '800' },

    customShareBlock: { gap: 8 },
    amtRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 12,
      minHeight: 46,
      gap: 6,
    },
    amtSymbol: { fontSize: 16, fontWeight: '800', flexShrink: 0 },
    personAmtInput: { flex: 1, fontSize: 17, fontWeight: '700', paddingVertical: 10 },

    contactStack: { gap: 8 },
    contactField: {
      minHeight: 50,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 14,
      fontSize: 16,
      fontWeight: '500',
      paddingVertical: 12,
    },
    savedTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    savedTag: { fontSize: 13, fontWeight: '700' },
    saveFriendBtn: { paddingVertical: 6 },
    saveFriendTxt: { fontSize: 15, fontWeight: '800' },

    addPersonBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      minHeight: 54,
      borderRadius: 14,
      borderWidth: 2,
      paddingHorizontal: 16,
      marginTop: 2,
    },
    addPersonBtnTxt: { fontSize: 16, fontWeight: '800' },
  });
}
