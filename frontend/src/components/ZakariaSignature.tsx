"use client";

import { motion } from "framer-motion";

const initialPath = { pathLength: 0, opacity: 0 };
const animatePath = { pathLength: 1, opacity: 1 };

type SignatureName = "Zakaria" | "Hamza";

type EffectProps = {
  className?: string;
  speed?: number;
  strokeColor?: string;
  accentColor?: string;
  strokeWidth?: number;
  onComplete?: () => void;
};

function ZakariaEffect({
  className = "",
  speed = 1,
  strokeColor = "currentColor",
  accentColor = "#facc15",
  strokeWidth = 10,
  onComplete,
}: EffectProps) {
  const calc = (value: number) => value * speed;

  return (
    <motion.svg
      className={className}
      fill="none"
      initial={{ opacity: 1 }}
      preserveAspectRatio="xMidYMid meet"
      stroke={strokeColor}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      style={{ overflow: "visible" }}
      viewBox="0 58 720 172"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>zakaria</title>

      <motion.path animate={animatePath} d="M18 95 C28 93 58 90 105 92" initial={initialPath} transition={{ duration: calc(0.3), ease: "easeInOut", opacity: { duration: 0.15 } }} />
      <motion.path animate={animatePath} d="M105 92 C95 108 62 148 22 188" initial={initialPath} transition={{ duration: calc(0.35), ease: "easeInOut", delay: calc(0.3), opacity: { duration: 0.15, delay: calc(0.3) } }} />
      <motion.path animate={animatePath} d="M22 188 C42 186 72 185 112 187 C122 187 130 180 135 168" initial={initialPath} transition={{ duration: calc(0.35), ease: "easeInOut", delay: calc(0.65), opacity: { duration: 0.15, delay: calc(0.65) } }} />
      <motion.path animate={animatePath} d="M135 168 C128 142 136 108 162 96 C182 87 198 96 200 118 C202 140 188 168 168 184 C152 193 140 194 136 188 C130 178 135 162 148 155 C162 148 182 148 200 158 C210 164 216 174 218 186 C220 194 224 192 230 182" initial={initialPath} transition={{ duration: calc(0.7), ease: "easeOut", delay: calc(1), opacity: { duration: 0.35, delay: calc(1) } }} />
      <motion.path animate={animatePath} d="M230 182 C236 158 248 112 258 52 C262 30 268 16 278 12 C288 8 294 16 294 32 C294 52 286 82 276 118 C270 140 266 160 264 178" initial={initialPath} transition={{ duration: calc(0.6), ease: "easeInOut", delay: calc(1.7), opacity: { duration: 0.3, delay: calc(1.7) } }} />
      <motion.path animate={animatePath} d="M270 140 C282 128 298 112 318 102" initial={initialPath} transition={{ duration: calc(0.25), ease: "easeOut", delay: calc(2.3), opacity: { duration: 0.12, delay: calc(2.3) } }} />
      <motion.path animate={animatePath} d="M282 132 C292 148 306 168 318 182 C326 192 334 192 344 182" initial={initialPath} transition={{ duration: calc(0.35), ease: "easeOut", delay: calc(2.55), opacity: { duration: 0.15, delay: calc(2.55) } }} />
      <motion.path animate={animatePath} d="M344 182 C338 158 344 118 370 102 C390 92 408 100 410 122 C412 144 398 172 378 186 C362 196 348 196 344 188 C338 178 345 162 360 155 C376 148 396 150 412 162 C422 170 428 180 430 190 C432 196 436 194 442 182" initial={initialPath} transition={{ duration: calc(0.7), ease: "easeOut", delay: calc(2.9), opacity: { duration: 0.35, delay: calc(2.9) } }} />
      <motion.path animate={animatePath} d="M442 182 C446 162 454 132 462 112 C466 102 474 94 486 94 C498 94 504 104 502 118 C500 132 492 148 486 158 C480 168 478 176 482 186" initial={initialPath} transition={{ duration: calc(0.5), ease: "easeOut", delay: calc(3.6), opacity: { duration: 0.25, delay: calc(3.6) } }} />
      <motion.path animate={animatePath} d="M482 186 C488 192 496 190 502 178 C510 160 518 132 526 112 C530 102 536 96 544 96 C552 96 556 104 556 116 C556 132 550 155 544 172 C540 182 538 190 542 194" initial={initialPath} transition={{ duration: calc(0.5), ease: "easeOut", delay: calc(4.1), opacity: { duration: 0.25, delay: calc(4.1) } }} />
      <motion.path animate={animatePath} d="M536 72 C538 68 542 66 546 68 C550 70 550 76 546 80 C542 82 538 80 536 76" initial={initialPath} transition={{ duration: calc(0.15), ease: "easeOut", delay: calc(6.8), opacity: { duration: 0.08, delay: calc(6.8) } }} />
      <motion.path animate={animatePath} d="M542 194 C548 192 556 184 562 172 C558 148 564 114 590 100 C610 90 628 98 630 120 C632 142 618 170 598 186 C582 198 568 198 562 188 C556 178 564 160 580 152 C596 146 616 148 632 160 C644 170 650 182 652 192 C654 198 660 196 668 184" initial={initialPath} transition={{ duration: calc(0.7), ease: "easeOut", delay: calc(4.6), opacity: { duration: 0.35, delay: calc(4.6) } }} />
      <motion.path animate={animatePath} d="M668 184 C678 162 690 148 698 148 C706 148 706 158 700 172 C694 186 682 196 672 198" initial={initialPath} transition={{ duration: calc(0.3), ease: "easeOut", delay: calc(5.3), opacity: { duration: 0.15, delay: calc(5.3) } }} />
      <motion.circle animate={{ opacity: 1, scale: 1 }} cx="543" cy="74" fill={accentColor} initial={{ opacity: 0, scale: 0 }} r="5" stroke="none" transition={{ duration: calc(0.3), ease: "easeOut", delay: calc(6) }} />
      <motion.path animate={animatePath} d="M80 218 C180 228 380 232 560 222 C640 216 680 208 700 198" initial={initialPath} stroke={accentColor} transition={{ duration: calc(0.6), ease: "easeInOut", delay: calc(6.3), opacity: { duration: 0.3, delay: calc(6.3) } }} onAnimationComplete={onComplete} />
    </motion.svg>
  );
}

function HamzaEffect({
  className = "",
  speed = 1,
  strokeColor = "currentColor",
  accentColor = "#38bdf8",
  strokeWidth = 10,
  onComplete,
}: EffectProps) {
  const calc = (value: number) => value * speed;

  return (
    <motion.svg
      className={className}
      fill="none"
      initial={{ opacity: 1 }}
      preserveAspectRatio="xMidYMid meet"
      stroke={strokeColor}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      style={{ overflow: "visible" }}
      viewBox="18 74 760 154"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>hamza</title>

      <motion.path animate={animatePath} d="M36 186 C44 160 56 114 66 56 C70 34 76 20 86 16 C96 12 102 20 102 36 C102 56 94 88 84 124 C78 146 74 166 72 184" initial={initialPath} transition={{ duration: calc(0.6), ease: "easeInOut", opacity: { duration: 0.18 } }} />
      <motion.path animate={animatePath} d="M72 184 C82 160 96 138 114 126 C128 116 142 120 146 136 C150 152 152 170 162 184 C166 190 172 190 180 182" initial={initialPath} transition={{ duration: calc(0.38), ease: "easeOut", delay: calc(0.58), opacity: { duration: 0.18, delay: calc(0.58) } }} />
      <motion.path animate={animatePath} d="M180 182 C174 158 180 118 206 102 C226 92 244 100 246 122 C248 144 234 172 214 186 C198 196 184 196 180 188 C174 178 181 162 196 155 C212 148 232 150 248 162 C258 170 264 180 266 190 C268 196 272 194 278 182" initial={initialPath} transition={{ duration: calc(0.72), ease: "easeOut", delay: calc(0.96), opacity: { duration: 0.32, delay: calc(0.96) } }} />
      <motion.path animate={animatePath} d="M278 182 C284 160 294 128 304 110 C312 98 324 96 332 108 C340 120 340 140 338 160 C346 138 358 114 374 106 C388 98 400 104 404 120 C408 136 406 154 402 172" initial={initialPath} transition={{ duration: calc(0.54), ease: "easeInOut", delay: calc(1.68), opacity: { duration: 0.24, delay: calc(1.68) } }} />
      <motion.path animate={animatePath} d="M402 172 C410 148 422 122 438 108 C452 96 464 102 468 118 C472 136 466 160 458 180 C454 190 458 194 466 188 C476 182 486 172 494 162" initial={initialPath} transition={{ duration: calc(0.46), ease: "easeInOut", delay: calc(2.22), opacity: { duration: 0.22, delay: calc(2.22) } }} />
      <motion.path animate={animatePath} d="M494 162 C512 154 540 150 574 152 C562 164 538 180 506 200" initial={initialPath} transition={{ duration: calc(0.3), ease: "easeOut", delay: calc(2.68), opacity: { duration: 0.14, delay: calc(2.68) } }} />
      <motion.path animate={animatePath} d="M506 200 C534 198 562 198 590 200 C600 200 608 194 614 182" initial={initialPath} transition={{ duration: calc(0.34), ease: "easeOut", delay: calc(2.98), opacity: { duration: 0.16, delay: calc(2.98) } }} />
      <motion.path animate={animatePath} d="M614 182 C608 158 614 118 640 102 C660 92 678 100 680 122 C682 144 668 172 648 186 C632 196 618 196 614 188 C608 178 615 162 630 155 C646 148 666 150 682 162 C692 170 698 180 700 190 C702 196 706 194 712 182" initial={initialPath} transition={{ duration: calc(0.72), ease: "easeOut", delay: calc(3.32), opacity: { duration: 0.32, delay: calc(3.32) } }} />
      <motion.path animate={animatePath} d="M712 182 C724 164 738 152 750 152 C760 152 762 162 756 174 C750 188 736 196 724 198" initial={initialPath} transition={{ duration: calc(0.3), ease: "easeOut", delay: calc(4.04), opacity: { duration: 0.15, delay: calc(4.04) } }} />
      <motion.path animate={animatePath} d="M90 220 C210 230 410 232 604 224 C686 220 734 210 756 198" initial={initialPath} stroke={accentColor} transition={{ duration: calc(0.58), ease: "easeInOut", delay: calc(4.32), opacity: { duration: 0.22, delay: calc(4.32) } }} onAnimationComplete={onComplete} />
    </motion.svg>
  );
}

export function TeamSignature({
  name,
  dark,
  onComplete,
}: {
  name: SignatureName;
  dark?: boolean;
  onComplete?: () => void;
}) {
  const stroke = dark ? "#f5f5f5" : "#171717";
  const accent = name === "Zakaria"
    ? dark ? "#facc15" : "#e11d48"
    : dark ? "#38bdf8" : "#0ea5e9";

  return (
    <motion.div
      key={name}
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.97 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="flex w-full items-center justify-center"
    >
      {name === "Zakaria" ? (
        <ZakariaEffect
          accentColor={accent}
          className="h-auto w-full max-w-[200px] sm:max-w-[220px]"
          speed={0.52}
          strokeColor={stroke}
          strokeWidth={9}
          onComplete={onComplete}
        />
      ) : (
        <HamzaEffect
          accentColor={accent}
          className="h-auto w-full max-w-[200px] sm:max-w-[220px]"
          speed={0.72}
          strokeColor={stroke}
          strokeWidth={9}
          onComplete={onComplete}
        />
      )}
    </motion.div>
  );
}
