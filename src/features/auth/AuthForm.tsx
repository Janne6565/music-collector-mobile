import { useRouter } from "expo-router";
import { Check, Disc3, Eye, EyeOff, HardDrive, Lock, Mail, User } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { passwordStrength } from "@janne6565/music-collector-shared";
import type { useAccountLogic } from "@/features/auth/useAccountLogic";
import { useStore } from "@/local/StoreProvider";
import { readLocalOnlyNoticeSeen } from "@/local/settings";
import { colors, fonts } from "@/theme/colors";

/** Screens 4a and 4b. */
export function AuthForm({ logic }: { readonly logic: ReturnType<typeof useAccountLogic> }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { store } = useStore();
  const registering = logic.mode === "REGISTER";

  /**
   * The no-account path goes to the library, because that is what "without an account"
   * means here: the app you already have. There is no back control beside it — sign-in is
   * a tab, not a pushed screen, so there would be nothing to pop and an arrow would
   * promise a retreat the tab bar already offers as a sideways move.
   *
   * It goes past the local-only notice the first time (17b).
   *
   * Once only: showing it on every visit would turn a disclosure into an obstacle, and the
   * same text stays reachable from the Datenschutzerklärung afterwards.
   */
  const leaveWithoutAccount = () => {
    void readLocalOnlyNoticeSeen(store).then((seen) => {
      router.replace(seen ? "/" : "/local-only");
    });
  };

  return (
    <View style={styles.root}>
      {registering ? (
        <Text style={styles.title}>{t("auth.createTitle")}</Text>
      ) : (
        <>
          <View style={styles.logo}>
            <Disc3 size={26} color={colors.paper} strokeWidth={1.6} />
          </View>
          <Text style={styles.title}>{t("auth.signInTitle")}</Text>
        </>
      )}
      <Text style={styles.lede}>{registering ? t("auth.createLede") : t("auth.signInLede")}</Text>

      {registering && (
        <Field
          label={t("auth.name")}
          icon={<User size={17} color={colors.inkSubtle} strokeWidth={1.75} />}
          value={logic.displayName}
          onChangeText={logic.setDisplayName}
          textContentType="name"
          placeholder={t("auth.namePlaceholder")}
        />
      )}

      <Field
        label={t("auth.email")}
        icon={<Mail size={17} color={colors.inkSubtle} strokeWidth={1.75} />}
        value={logic.email}
        onChangeText={logic.setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        textContentType="emailAddress"
        placeholder={t("auth.emailPlaceholder")}
      />

      <PasswordInput logic={logic} registering={registering} />

      {registering ? (
        <View style={styles.consents}>
          <Toggle checked={logic.agreed} onPress={() => logic.setAgreed(!logic.agreed)}>
            {t("auth.agreeTerms")}
          </Toggle>
          <View style={styles.consentLinks}>
            <Pressable accessibilityRole="link" onPress={() => router.push("/legal/nutzungsbedingungen")}>
              <Text style={styles.consentLink}>{t("legal.terms")}</Text>
            </Pressable>
            <Text style={styles.consentSeparator}>·</Text>
            <Pressable accessibilityRole="link" onPress={() => router.push("/legal/datenschutz")}>
              <Text style={styles.consentLink}>{t("legal.privacy")}</Text>
            </Pressable>
          </View>
          <Toggle
            checked={logic.ageConfirmed}
            onPress={() => logic.setAgeConfirmed(!logic.ageConfirmed)}
          >
            {t("auth.confirmAge")}
          </Toggle>
        </View>
      ) : (
        <Toggle checked={logic.rememberMe} onPress={() => logic.setRememberMe(!logic.rememberMe)}>
          {t("auth.rememberMe")}
        </Toggle>
      )}

      {logic.failed !== null && <Text style={styles.error}>{errorText(logic.failed, t)}</Text>}
      {logic.resetSent && <Text style={styles.notice}>{t("auth.forgotSent")}</Text>}

      <Pressable
        accessibilityRole="button"
        onPress={() => void logic.submit()}
        disabled={!logic.canSubmit || logic.busy}
        style={[styles.primary, (!logic.canSubmit || logic.busy) && styles.dim]}
      >
        {logic.busy ? (
          <ActivityIndicator size="small" color={colors.paper} />
        ) : (
          <Text style={styles.primaryText}>{registering ? t("auth.create") : t("auth.signIn")}</Text>
        )}
      </Pressable>

      {logic.providers.length > 0 && (
        <>
          <View style={styles.divider}>
            <View style={styles.rule} />
            <Text style={styles.dividerText}>{t("auth.or")}</Text>
            <View style={styles.rule} />
          </View>
          {registering && (
            /* The provider buttons have no form to put tick boxes in, so the agreement is
               stated beside them instead. The account they create records the same consent
               a password sign-up does. */
            <Text style={styles.providerConsent}>{t("auth.providerConsent")}</Text>
          )}
          {logic.providers.map((provider) => (
            <Pressable
              key={provider.id}
              accessibilityRole="button"
              // Opened in the system browser: the provider will refuse an embedded webview,
              // and the system browser is where any existing session already lives. The
              // browser hands control back to the app when it is done.
              onPress={() => void logic.signInWith(provider.id)}
              disabled={logic.busy}
              style={[styles.secondary, logic.busy && styles.dim]}
            >
              <Text style={styles.secondaryText}>
                {t("auth.continueWith", { provider: provider.displayName })}
              </Text>
            </Pressable>
          ))}
        </>
      )}

      {/* The no-account path is a real control, not a footnote: same pill as the provider
          buttons, sitting with the other ways in and above the sign-in/register switch.
          The app is fully usable without an account, and hiding that would be a lie about
          what signing in is for. The darker border is the one thing that separates it from
          a provider button — it is a destination, not a handoff. */}
      <Pressable
        accessibilityRole="button"
        onPress={leaveWithoutAccount}
        style={[styles.secondary, styles.without]}
      >
        <HardDrive size={16} color={colors.inkSubtle} strokeWidth={1.75} />
        <Text style={styles.withoutText}>
          {registering ? t("auth.skipRegister") : t("auth.useWithout")}
        </Text>
      </Pressable>
      {!registering && <Text style={styles.withoutNote}>{t("auth.useWithoutBody")}</Text>}

      <Pressable accessibilityRole="button" onPress={() => logic.setMode(registering ? "SIGN_IN" : "REGISTER")}>
        <Text style={styles.switchMode}>
          {registering ? t("auth.haveAccount") : t("auth.needAccount")}
        </Text>
      </Pressable>
    </View>
  );
}

function PasswordInput({
  logic,
  registering,
}: {
  readonly logic: ReturnType<typeof useAccountLogic>;
  readonly registering: boolean;
}) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const strength = passwordStrength(logic.password);

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{t("auth.password")}</Text>
        {!registering && (
          <Pressable accessibilityRole="button" onPress={() => void logic.forgotPassword()}>
            <Text style={styles.forgot}>{t("auth.forgot")}</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.inputBox}>
        <Lock size={17} color={colors.inkSubtle} strokeWidth={1.75} />
        <TextInput
          value={logic.password}
          onChangeText={logic.setPassword}
          secureTextEntry={!visible}
          autoCapitalize="none"
          textContentType={registering ? "newPassword" : "password"}
          placeholder={registering ? t("auth.newPasswordPlaceholder") : t("auth.passwordPlaceholder")}
          placeholderTextColor={colors.inkSubtle}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          // Labelled by what pressing it does rather than the current state.
          accessibilityLabel={visible ? t("auth.hidePassword") : t("auth.showPassword")}
          onPress={() => setVisible(!visible)}
        >
          {visible ? (
            <EyeOff size={17} color={colors.inkSubtle} strokeWidth={1.75} />
          ) : (
            <Eye size={17} color={colors.inkSubtle} strokeWidth={1.75} />
          )}
        </Pressable>
      </View>

      {registering && (
        <>
          <View style={styles.meter}>
            {[1, 2, 3].map((bar) => (
              <View
                key={bar}
                style={[styles.bar, { backgroundColor: bar <= strength ? colors.accent : colors.line }]}
              />
            ))}
          </View>
          <Text style={styles.hint}>{t("auth.passwordHint")}</Text>
        </>
      )}
    </View>
  );
}

function Field({
  label,
  icon,
  ...input
}: { readonly label: string; readonly icon: React.ReactNode } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputBox}>
        {icon}
        <TextInput placeholderTextColor={colors.inkSubtle} {...input} style={styles.input} />
      </View>
    </View>
  );
}

function Toggle({
  checked,
  onPress,
  children,
}: {
  readonly checked: boolean;
  readonly onPress: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={styles.toggle}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Check size={13} color={colors.paper} strokeWidth={2.5} />}
      </View>
      <Text style={styles.toggleText}>{children}</Text>
    </Pressable>
  );
}

function errorText(error: NonNullable<ReturnType<typeof useAccountLogic>["failed"]>, t: (k: never) => string) {
  const translate = t as unknown as (key: string) => string;
  return error === "badCredentials"
    ? translate("auth.error.badCredentials")
    : error === "emailTaken"
      ? translate("auth.error.emailTaken")
      : translate("auth.error.generic");
}

const styles = StyleSheet.create({
  consents: { gap: 12 },
  providerConsent: { fontSize: 11, lineHeight: 17, color: colors.inkSubtle, marginBottom: 4 },
  // Indented to the checkbox label, so the two document names read as belonging to the
  // sentence above them rather than to the age tick below.
  consentLinks: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 31, marginTop: -4 },
  consentLink: { fontSize: 12, fontWeight: "600", color: colors.accent },
  consentSeparator: { fontSize: 12, color: colors.inkSubtle },
  root: { gap: 14 },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: fonts.serif, fontSize: 34, color: colors.ink },
  lede: { fontSize: 14, lineHeight: 21, color: colors.inkMuted, marginTop: -8 },
  field: { gap: 7 },
  labelRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  label: { fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.inkSubtle, fontWeight: "500" },
  forgot: { fontSize: 11.5, fontWeight: "500", color: colors.accent },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  input: { flex: 1, fontSize: 15, color: colors.ink },
  meter: { flexDirection: "row", gap: 5, marginTop: 2 },
  bar: { flex: 1, height: 3, borderRadius: 2 },
  hint: { fontSize: 11.5, color: colors.inkSubtle },
  toggle: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  box: {
    width: 19,
    height: 19,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: { backgroundColor: colors.ink, borderColor: colors.ink },
  toggleText: { flex: 1, fontSize: 12.5, lineHeight: 19, color: colors.inkMuted },
  error: { fontSize: 13, color: colors.accent },
  notice: { fontSize: 13, color: colors.inkMuted },
  primary: {
    height: 50,
    borderRadius: 999,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: colors.paper, fontSize: 15, fontWeight: "600" },
  dim: { opacity: 0.5 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  dividerText: { fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.inkSubtle },
  secondary: {
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontSize: 14, fontWeight: "600", color: colors.ink },
  switchMode: { textAlign: "center", fontSize: 13, color: colors.inkMuted, marginTop: 4 },
  without: {
    flexDirection: "row",
    gap: 9,
    borderWidth: 1,
    borderColor: colors.inkSubtle,
    marginTop: 2,
  },
  withoutText: { fontSize: 14, fontWeight: "600", color: colors.ink },
  withoutNote: {
    textAlign: "center",
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.inkSubtle,
    maxWidth: 280,
    alignSelf: "center",
  },
});
