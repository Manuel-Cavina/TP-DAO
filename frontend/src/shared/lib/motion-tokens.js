/**
 * Arc UI Motion Tokens (`arc-motion-tokens`)
 * Mirrors `https://uiarc.dev/r/arc-motion-tokens.json` for use across React components.
 */

export const motionTokens = {
  duration: {
    instant: 0.09,
    fast: 0.14,
    normal: 0.2,
    slow: 0.3,
  },
  ease: {
    enter: [0.22, 1, 0.36, 1],
    standard: [0.22, 1, 0.36, 1],
    exit: [0.4, 0, 1, 1],
  },
  spring: {
    snappy: {
      type: "spring",
      stiffness: 520,
      damping: 36,
      mass: 0.65,
    },
    smooth: {
      type: "spring",
      stiffness: 380,
      damping: 32,
      mass: 0.8,
    },
    morph: {
      type: "spring",
      stiffness: 420,
      damping: 34,
      mass: 0.72,
    },
  },
  stagger: {
    tight: 0.025,
    normal: 0.045,
    relaxed: 0.07,
  },
  blur: {
    subtle: "4px",
    standard: "8px",
  },
};

export default motionTokens;
