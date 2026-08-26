import {
  DURATION,
  EASING,
  REDUCED,
  WASH_DARK,
  WASH_LANES,
  WASH_INSTANT_BEFORE,
  type CoverTheme,
  type DetailChrome,
  chromeFor,
  lightnessOfHex,
} from "@janne6565/music-collector-shared";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";

/**
 * The cover-theme wash (turn 13c/13d) — the one moment in this app where a screen changes
 * under a reader who has not touched it.
 *
 * A release added from search arrives with no palette; it is sampled server-side on the
 * detail lookup, which is now fetched *beside* the screen rather than in front of it. So
 * the record opens in paper and the sleeve's colour lands anywhere from 100ms to several
 * seconds later — sometimes taking the whole screen from paper to near-black.
 *
 * The deck's finding, and the reason this is not one tween: interpolating ink and paper
 * together passes through a grey where neither is legible. So the text does not tween. Two
 * stacked copies of the screen cross-fade over 100ms at the point where the contrast
 * crosses, while the background alone runs the full 560ms underneath them.
 *
 * Nothing here interpolates `backgroundColor`, which would be JS-driven and stutters on a
 * cheap Android device. The themed screen is rendered *under* the paper one and it is the
 * paper layer's opacity that moves, on the native driver. Same picture, no dropped frames,
 * and no animation library.
 */
export interface CoverWash {
  /** The chrome to draw the screen in — the destination, from the first frame. */
  readonly chrome: DetailChrome;
  /** The chrome the outgoing copy is drawn in, or null when there is nothing to fade out. */
  readonly outgoing: DetailChrome | null;
  /** Opacity of the layer covering the themed background while it washes in. */
  readonly paper: Animated.Value;
  /**
   * What that covering layer is coloured.
   *
   * Paper when the screen is arriving from no theme at all, and the *previous* sleeve's
   * tone when one cover is being swapped for another. Fading through paper on the way from
   * one dark cover to another would be a white flash between two near-blacks -- worse than
   * the snap it was meant to replace.
   */
  readonly washFrom: string;
  /** Opacity of the outgoing copy of the screen's content. */
  readonly outgoingOpacity: Animated.Value;
  /** Opacity of accent-coloured marks, which land last. */
  readonly accent: Animated.Value;
  /** What the status bar should be while the wash runs. It flips with the text. */
  readonly barStyle: "light" | "dark";
}

const bezier = (curve: readonly [number, number, number, number]) =>
  Easing.bezier(curve[0], curve[1], curve[2], curve[3]);

export function useCoverWash(theme: CoverTheme | null): CoverWash {
  const chrome = chromeFor(theme);

  const paper = useRef(new Animated.Value(0)).current;
  const outgoingOpacity = useRef(new Animated.Value(0)).current;
  const accent = useRef(new Animated.Value(1)).current;

  const mountedAt = useRef(Date.now());
  /** The chrome the screen was in before this theme arrived, while it fades away. */
  const [outgoing, setOutgoing] = useState<DetailChrome | null>(null);
  const [barStyle, setBarStyle] = useState<"light" | "dark">(chrome.dark ? "light" : "dark");
  const previous = useRef<CoverTheme | null>(theme);
  const [washFrom, setWashFrom] = useState<string>(chromeFor(null).background);
  const reduced = useRef(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) reduced.current = on;
    });
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", (on) => {
      reduced.current = on;
    });
    return () => {
      alive = false;
      listener.remove();
    };
  }, []);

  useEffect(() => {
    const was = previous.current;
    previous.current = theme;

    // Nothing arrived. No fade to neutral, no flash, no retry affordance — paper was
    // already the answer, and a failure looks identical to it.
    if (theme === null) {
      setBarStyle(chrome.dark ? "light" : "dark");
      return;
    }

    const from = chromeFor(was);
    const to = chromeFor(theme);
    if (from.dark === to.dark && from.background === to.background) {
      setBarStyle(to.dark ? "light" : "dark");
      return;
    }

    /*
     * One cover swapped for another, which only happens now that the record next to this
     * one is a swipe away. The background alone crosses -- the words are already being
     * handed over by whatever caused the swap, and a second fade on top of that reads as
     * mud. It crosses *from the old sleeve's tone*, never through paper: two dark covers
     * with a white flash between them would be worse than the snap this replaces.
     */
    if (was !== null) {
      setWashFrom(from.background);
      paper.setValue(1);
      const flipBar = setTimeout(() => setBarStyle(to.dark ? "light" : "dark"), WASH_LANES.textAt);
      Animated.timing(paper, {
        toValue: 0,
        duration: reduced.current ? REDUCED.washDuration : DURATION.wash,
        easing: bezier(EASING.move),
        useNativeDriver: true,
      }).start();
      return () => clearTimeout(flipBar);
    }

    setWashFrom(chromeFor(null).background);

    /*
     * Landed while the push was still settling. A wash inside a push reads as a glitch, so
     * it is applied outright — and the reader never saw the paper version anyway.
     */
    if (Date.now() - mountedAt.current < WASH_INSTANT_BEFORE) {
      paper.setValue(0);
      setBarStyle(to.dark ? "light" : "dark");
      return;
    }

    if (reduced.current) {
      // The fade stays; only the staging goes.
      paper.setValue(1);
      setBarStyle(to.dark ? "light" : "dark");
      Animated.timing(paper, {
        toValue: 0,
        duration: REDUCED.washDuration,
        easing: bezier(EASING.move),
        useNativeDriver: true,
      }).start();
      return;
    }

    /*
     * The bigger the change, the more it has to read as a wash rather than a light switch,
     * so a very dark target stretches and takes the text swap with it.
     */
    const gap = Math.abs((lightnessOfHex(theme.dominantColor) ?? 0.5) - 0.97);
    const long = gap > WASH_DARK.gapThreshold;
    const duration = long ? WASH_DARK.duration : DURATION.wash;
    const textAt = long ? WASH_DARK.textAt : WASH_LANES.textAt;

    paper.setValue(1);
    outgoingOpacity.setValue(1);
    accent.setValue(0);
    setOutgoing(from);

    // Lane one: the background, the whole way, on its own.
    Animated.timing(paper, {
      toValue: 0,
      duration,
      easing: bezier(EASING.move),
      useNativeDriver: true,
    }).start();

    // Lane two: the text, as two stacked copies rather than one tween through grey. The
    // 100ms is centred on the crossing point, so it starts half of it earlier.
    Animated.timing(outgoingOpacity, {
      toValue: 0,
      delay: Math.max(0, textAt - WASH_LANES.textDuration / 2),
      duration: WASH_LANES.textDuration,
      easing: bezier(EASING.move),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setOutgoing(null);
    });

    // The bar belongs to the text, not the background: it flips when the words do.
    const flip = setTimeout(() => setBarStyle(to.dark ? "light" : "dark"), textAt);

    // Lane three: the accent lands last, once there is a settled chrome to be legible on.
    Animated.timing(accent, {
      toValue: 1,
      delay: WASH_LANES.accentAt,
      duration: WASH_LANES.accentDuration,
      easing: bezier(EASING.move),
      useNativeDriver: true,
    }).start();

    return () => clearTimeout(flip);
  }, [theme, chrome.dark, paper, outgoingOpacity, accent]);

  return { chrome, outgoing, paper, washFrom, outgoingOpacity, accent, barStyle };
}
