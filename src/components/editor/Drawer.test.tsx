import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { Drawer } from "./Drawer";

afterEach(cleanup);

describe("the tool drawer", () => {
  it("is a notch when closed, and says so", () => {
    render(
      <Drawer open={false} onOpenChange={() => {}}>
        tools
      </Drawer>,
    );
    expect(screen.getByRole("button", { name: /open the tools/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("opens from its notch", () => {
    const onOpenChange = vi.fn();
    render(
      <Drawer open={false} onOpenChange={onOpenChange}>
        tools
      </Drawer>,
    );
    fireEvent.click(screen.getByRole("button", { name: /open the tools/i }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  /**
   * Open, the way out belongs beside the title in the header, where it can be a
   * proper button. A 26px sliver hanging off the top corner is not something
   * anybody goes looking for — and the drawer crops to 26px when shut, so the
   * sliver could not grow on hover without being sliced by that crop either.
   */
  it("keeps no handle of its own once it is open", () => {
    render(
      <Drawer open onOpenChange={() => {}}>
        tools
      </Drawer>,
    );
    expect(screen.queryByRole("button", { name: /open the tools/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /close the tools/i })).toBeNull();
  });

  // Nothing to press while the screen is cleared for a look.
  it("takes its notch away with everything else", () => {
    render(
      <Drawer open={false} hidden onOpenChange={() => {}}>
        tools
      </Drawer>,
    );
    expect(screen.queryByRole("button", { name: /open the tools/i })).toBeNull();
  });

  /**
   * The panel is lifted out of the flow so the drawer's width cannot squash it:
   * opening has to reveal a panel sliding out, not a narrow one stretching into
   * place, and forty rows reflowing on every frame of the travel is the other
   * thing that would make it do.
   */
  it("takes its contents out of the flow so the travel cannot squash them", () => {
    const { container } = render(
      <Drawer open={false} onOpenChange={() => {}}>
        tools
      </Drawer>,
    );
    const inner = container.querySelector(".cg-drawer__inner") as HTMLElement;
    expect(inner).toHaveClass("absolute");
    expect(inner).toHaveClass("inset-y-0");
    expect(inner).toHaveClass("right-0");
    expect(screen.getByText("tools")).toBeInTheDocument();
  });

  // Shut, the panel is off the edge rather than cropped to the notch — so a tab
  // press must not be able to land on a control nobody can see.
  it("puts its contents beyond reach while it is shut", () => {
    const { container, rerender } = render(
      <Drawer open={false} onOpenChange={() => {}}>
        tools
      </Drawer>,
    );
    expect(container.querySelector(".cg-drawer__inner")).toHaveAttribute("inert");

    rerender(
      <Drawer open onOpenChange={() => {}}>
        tools
      </Drawer>,
    );
    expect(container.querySelector(".cg-drawer__inner")).not.toHaveAttribute("inert");
  });

  it("goes with everything else when the screen is cleared", () => {
    const { container } = render(
      <Drawer open hidden onOpenChange={() => {}}>
        tools
      </Drawer>,
    );
    expect(container.querySelector(".cg-drawer")).toHaveAttribute("data-hidden");
  });
});
