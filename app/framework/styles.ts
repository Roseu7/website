import osCss from "~/styles/os.css?url";
import shellCss from "~/styles/shell.css?url";
import homeCss from "~/styles/home.css?url";
import aboutCss from "~/styles/pages/about.css?url";
import projectsCss from "~/styles/pages/projects.css?url";
import legalCss from "~/styles/pages/legal.css?url";
import directoryCss from "~/styles/pages/tools.css?url";
import solverCss from "~/styles/pages/solver.css?url";
import jevCss from "~/styles/pages/jev.css?url";
import umigameCss from "~/styles/umigame.css?url";
import umigameAdminCss from "~/styles/umigame/80-observability.css?url";
import mcCss from "~/styles/mc.css?url";
import homeControlCss from "~/styles/pages/home-control.css?url";
import settingsCss from "~/styles/pages/settings.css?url";
import consoleCss from "~/styles/pages/console.css?url";
import notepadCss from "~/styles/pages/notepad.css?url";
import { isOsPath } from "~/utils/os";

export function getPageStyles(pathname: string, osEnabled: boolean, data?: unknown, failed = false) {
  const styles = [osEnabled && (failed || isOsPath(pathname)) ? osCss : shellCss];
  if (failed) return styles;
  if (pathname.startsWith("/games/umigame")) {
    styles.push(umigameCss);
    if (pathname.startsWith("/games/umigame/admin")) styles.push(umigameAdminCss);
  }
  else if (pathname === "/tools/wsolver") styles.push(solverCss);
  else if (pathname === "/tools/jev") styles.push(jevCss);
  else if (["/tools", "/games", "/lab"].includes(pathname)) styles.push(directoryCss);
  else if (pathname === "/settings" || pathname.startsWith("/settings/")) styles.push(settingsCss);
  else if (pathname === "/console") styles.push(consoleCss);
  else if (pathname === "/notepad") styles.push(notepadCss);
  else if (pathname === "/about") styles.push(aboutCss);
  else if (pathname === "/projects") styles.push(projectsCss);
  else if (["/contact", "/licenses", "/privacy", "/terms"].includes(pathname)) styles.push(legalCss);
  else if (pathname === "/apply") styles.push(mcCss);
  else if (pathname === "/home-control") styles.push(homeControlCss);
  else if (pathname === "/" && !osEnabled) {
    if (data && typeof data === "object" && "isMcDashboardHost" in data && data.isMcDashboardHost) styles.push(mcCss);
    else if (data && typeof data === "object" && "isHomeControlHost" in data && data.isHomeControlHost) styles.push(homeControlCss);
    else styles.push(homeCss);
  }
  return styles;
}
