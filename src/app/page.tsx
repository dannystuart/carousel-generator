import { Editor } from "@/components/editor/Editor";
import { FullScreenStage } from "@/components/editor/FullScreenStage";

/**
 * The tool. Server component doing nothing but handing off, because everything
 * here is a live carousel and a panel of sliders.
 *
 * The preview loads already full of imagery and already at a real style —
 * nobody should have to touch anything to see something worth screenshotting.
 *
 * The editor fills its container and nothing more, so the box is supplied here.
 * On this site that box is the whole window; ported onto a page that has a
 * header, a footer and copy of its own, the same component sits in a figure
 * instead and only this wrapper is left behind.
 */
export default function Home() {
  return (
    <FullScreenStage>
      <Editor />
    </FullScreenStage>
  );
}
