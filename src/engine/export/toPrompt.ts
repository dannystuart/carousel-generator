import { DEFAULT_PARAMS } from "../defaults";
import { EASINGS } from "../easing";
import { arcRadius, stepAngle } from "../geometry";
import type { CarouselParams } from "../types";

export interface PromptOptions {
  params: CarouselParams;
  cards: number;
  /** The style's name, when the sliders are still sitting on one. */
  styleName?: string;
}

const round = (value: number, places = 0) => {
  const factor = 10 ** places;
  return String(Math.round(value * factor) / factor);
};

/**
 * A written description of exactly what is on screen, to hand to Claude, Cursor
 * or ChatGPT so the effect can be rebuilt in React, Vue, Webflow or anything
 * else. It covers every framework without us maintaining one of them.
 *
 * Two rules make it useful rather than merely fluent.
 *
 * Everything a style changes gets said, with its real number — an AI cannot
 * infer that the arc's radius is 2980px from "a shallow arc", and a rebuild
 * that guesses is a rebuild that looks wrong.
 *
 * And everything a style leaves alone stays unsaid. A brief that recites all
 * forty dials at their defaults is a dump, not a description: the reader cannot
 * tell what matters, which is the one thing the prose is for. The exceptions are
 * the handful you cannot rebuild anything without — how many cards, how big,
 * how far apart, how long a move takes — which are stated whatever they are set
 * to.
 */
export function toPrompt({ params: p, cards, styleName }: PromptOptions): string {
  const d = DEFAULT_PARAMS;
  const changed = <K extends keyof CarouselParams>(key: K) =>
    JSON.stringify(p[key]) !== JSON.stringify(d[key]);

  const sentences: string[] = [];
  const height = Math.round(p.cardWidth * p.cardAspect);

  sentences.push(
    `Build a 3D ${styleName ? `${styleName.toLowerCase()} ` : ""}carousel.`,
    `${cards} cards, ${round(p.cardWidth)}×${height}px cards with ${round(p.cardRadius)}px corners.`,
  );

  // --- the arrangement ---------------------------------------------------
  if (p.curve === 0) {
    sentences.push(`They sit on a straight track, ${round(p.spacing)}px apart.`);
  } else {
    const step = (stepAngle(p.curve, cards) * 180) / Math.PI;
    const radius = arcRadius(p.curve, p.spacing, cards);
    const shape = p.curve >= 0.999 ? "a ring that closes on itself" : p.curve > 0.5 ? "a deep arc" : "a shallow arc";
    const recede = Math.abs(radius * (1 - Math.cos((step * Math.PI) / 180 * Math.min(cards / 2, 4))) * p.depth);
    // Where the arc has been rotated into the screen plane there is no depth to
    // recede into — the same displacement happens up the page instead, and
    // saying "in depth" there would be describing a different arrangement.
    const inScreenPlane = Math.abs(Math.cos((p.arcRotation * Math.PI) / 180)) < 1e-9;
    const away = inScreenPlane ? "up the screen" : "in depth";
    sentences.push(
      `They are laid along ${shape}, ${round(p.spacing)}px apart — each step advances ${round(step, 1)}° around a circle of radius ${round(radius)}px, so four cards out the arc has moved ${round(recede)}px ${away}.`,
    );
    if (changed("depth")) sentences.push(`That depth is multiplied by ${round(p.depth, 2)}.`);
    if (p.invert) {
      sentences.push(
        "The curve is inverted: the focused card sits furthest away and the outer cards come toward the viewer, so you are standing inside the arc.",
      );
    }
    if (changed("arcRotation")) {
      const flatInScreen = Math.abs(p.arcRotation) >= 89;
      const closed = p.curve >= 0.999;
      if (flatInScreen && closed) {
        sentences.push(
          "Arc rotation of 90° lays the ring flat in the screen plane, so it reads as a circle of cards on the page rather than as a bowl receding away. Nothing in it has depth.",
        );
      } else if (flatInScreen) {
        sentences.push(
          p.arcRotation > 0
            ? "Arc rotation of 90° stands the bend up in the screen plane as an arch: the focused card at the apex, the rest hanging away down both sides. It is drawn, not projected, so it has no depth."
            : "Arc rotation of -90° hangs the bend down the screen as a valley, the focused card at the bottom. It is drawn, not projected, so it has no depth.",
        );
      } else {
        sentences.push(
          `Arc rotation of ${round(p.arcRotation)}° swings the bend part way from into the screen toward up it.`,
        );
      }
    }
    if (changed("risePerTurn")) {
      sentences.push(`The arrangement climbs ${round(p.risePerTurn)}px per full turn, making a helix.`);
    }
  }

  if (changed("rings") && p.rings.length > 1) {
    const described = p.rings
      .map((ring, i) => `ring ${i + 1} at ${round(ring.scale, 2)}× the radius${ring.drift ? `, drifting ${round(ring.drift, 2)} cards per second` : ""}`)
      .join("; ");
    sentences.push(`There are ${p.rings.length} concentric rings sharing one centre — ${described}.`);
  } else if (changed("rings") && p.rings[0]?.drift) {
    sentences.push(`It turns on its own at ${round(p.rings[0].drift, 2)} cards per second, continuously.`);
  }

  if (changed("bandRows")) {
    // Each row sits one card height below the last, so the gap is stated once
    // and the reader can stack as many as the setting asks for.
    sentences.push(`The set is split across ${p.bandRows} rows wrapped around the same surface, each row ${round(p.cardWidth * p.cardAspect * 1.04)}px below the one above.`);
  }

  // --- how the cards are turned ------------------------------------------
  const orientation: string[] = [];
  if (changed("cardAngle") || p.cardAngle > 0) {
    orientation.push(
      p.cardAngle > 0
        ? `each card is yawed up to ${round(p.cardAngle)}° away from the viewer, sign following its side of centre`
        : "cards are not yawed",
    );
  }
  if (changed("cardFacing")) {
    orientation.push(
      p.cardFacing > 0
        ? p.cardFacing >= 0.999
          ? "cards follow the curve completely, each one turned by its own angle around the arc so it stays tangent to it"
          : `cards follow the curve ${round(p.cardFacing * 100)}% of the way, each partly turned by its own angle around it`
        : `cards turn ${round(Math.abs(p.cardFacing), 2)} of the way *against* the curve, which fans them the opposite way and reads as scattered rather than ordered`,
    );
  }
  if (changed("cardUpright")) {
    orientation.push(`the scene's roll is cancelled per card by ${round(p.cardUpright, 2)}, so the track runs diagonally while the cards stay straight`);
  }
  if (orientation.length > 0) sentences.push(`${orientation.join("; ")}.`.replace(/^./, (c) => c.toUpperCase()));

  // --- how they fall away -------------------------------------------------
  const falloff = [
    p.sizeFalloff > 0
      ? `Scale falls as 1/(1+${round(p.sizeFalloff, 2)}·n) with distance n from the focused card`
      : "Cards do not shrink with distance — whatever size change there is comes from perspective alone",
  ];
  if (p.fadeFalloff > 0) falloff.push(`opacity falls ${round(p.fadeFalloff, 2)} per step`);
  if (p.blurFalloff > 0) {
    falloff.push(`blur grows ${round(p.blurFalloff, 2)}px per step, measured in screen pixels — divide by each card's own scale, because a filter resolves before its ancestor's transform`);
  }
  sentences.push(`${falloff.join("; ")}.`);

  if (changed("sizeGradient")) {
    sentences.push(
      `On top of that a size gradient of ${round(p.sizeGradient, 2)} runs one way round the ring: scale is multiplied by 1 + ${round(p.sizeGradient * 0.12, 4)}·offset, so cards grow steadily in one direction and shrink to a speck in the other.`,
    );
  }
  if (changed("jitter")) {
    sentences.push(
      `A jitter of ${round(p.jitter, 2)} nudges each card up to ${round(18 * p.jitter)}px and tilts it up to ${round(7 * p.jitter, 1)}° in the viewing plane, from a seeded random value — the same every load, never Math.random, or the exported code and the preview would disagree.`,
    );
  }
  if (changed("sizeJitter")) {
    sentences.push(
      `A size jitter of ${round(p.sizeJitter, 2)} varies card sizes by up to ${round(55 * p.sizeJitter)}% from that same seeded source, so the row reads as hand-laid rather than as a uniform strip.`,
    );
  }
  if (changed("transparency")) {
    sentences.push(`Cards are glassy at ${round(p.transparency, 2)} — a translucent fill over the ones behind, not a backdrop-filter, which would cost a blur of the backdrop every frame.`);
  }

  // --- camera --------------------------------------------------------------
  const camera = [`Scene perspective ${round(p.distance)}px`];
  camera.push(p.pitch === 0 ? "no pitch" : `pitched ${round(p.pitch)}° about the middle of the arrangement`);
  camera.push(p.tilt === 0 ? "no roll" : `rolled ${round(p.tilt)}°`);
  sentences.push(`${camera.join(", ")}.`);

  if (changed("zoom")) {
    // Said as what to do rather than as a number, because the whole point is that
    // it is not the perspective: scale the scene and the camera by the same
    // amount and the picture only changes size.
    sentences.push(
      `The whole scene is then zoomed to ${round(p.zoom, 2)}× — scale the arrangement and the perspective distance together by that amount, so the framing changes and the perspective does not.`,
    );
  }

  // --- card content ---------------------------------------------------------
  if (p.cardReveal !== "never") {
    const when = { focus: "when it is the focused card", hover: "on hover", both: "when focused or hovered" }[p.cardReveal];
    sentences.push(
      `Each card carries a title, a caption and a button, revealed ${when} while the picture inside it scales to ${round(p.revealZoom, 2)}× — the picture, not the card, because scaling a card swings its edges out of its own plane and neighbours intersect.`,
    );
    if (p.contentLayout === "button") {
      sentences.push(
        `Show only the button, centred on the card over a soft dark veil; keep the title and caption in the markup but visually hidden, so screen readers still get them.`,
      );
    }
    if (changed("buttonScale")) {
      sentences.push(`Draw the button at ${round(p.buttonScale, 2)}× its usual size.`);
    }
  }

  // --- motion ---------------------------------------------------------------
  const easing = EASINGS[p.easing];
  sentences.push(`A move takes ${round(p.speed)}ms on ${easing.css}.`);

  // --- interaction ----------------------------------------------------------
  const interaction: string[] = [];
  if (p.drag) {
    interaction.push(
      `drag with momentum${p.dragWeight !== d.dragWeight ? ` weighted ${round(p.dragWeight, 2)}×` : ""}${p.snap ? " and snap-to-centre" : ", free, without snapping"}`,
    );
  } else {
    interaction.push("no dragging");
  }
  interaction.push(p.arrows ? "arrow buttons" : "no arrow buttons");
  if (p.dots) interaction.push("dots");
  if (p.tapToFocus) interaction.push("tapping a card brings it to the centre");
  interaction.push("arrow keys move one card, Home and End jump to the ends");
  if (p.wheel) interaction.push("the mouse wheel moves it");
  interaction.push(
    p.autoplay ? `autoplay every ${round(p.autoplayInterval)}ms${p.pauseOnHover ? ", paused on hover" : ""}` : "no autoplay",
  );
  if (!p.loop) interaction.push("it stops at the ends rather than looping");
  sentences.push(`${interaction.join("; ")}.`.replace(/^./, (c) => c.toUpperCase()));

  sentences.push(
    "Under prefers-reduced-motion, keep the arrangement exactly as described — the curve, the angles, the depth, the camera — and crossfade between cards over 180ms instead of sweeping, with nothing moving on its own.",
  );

  return sentences.join(" ").replace(/\s+/g, " ").trim();
}
