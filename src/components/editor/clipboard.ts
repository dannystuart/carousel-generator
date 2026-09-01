/** Best effort, then the old way, then tell the truth. */
export async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Safari without a user-gesture-adjacent call, or an insecure origin.
    try {
      const scratch = document.createElement("textarea");
      scratch.value = text;
      scratch.setAttribute("readonly", "");
      scratch.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(scratch);
      scratch.select();
      const ok = document.execCommand("copy");
      scratch.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
