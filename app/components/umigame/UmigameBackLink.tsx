import type { MouseEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { usePreviousPage } from "~/components/routing/usePreviousPage";
import { labelForPreviousPath } from "~/utils/umigame/navigation";

export function UmigameBackLink({
  fallbackTo,
  fallbackLabel,
}: {
  fallbackTo: string;
  fallbackLabel: string;
}) {
  const navigate = useNavigate();
  const previous = usePreviousPage();
  const label = previous?.available
    ? previous.path ? labelForPreviousPath(previous.path) : "前のページに戻る"
    : fallbackLabel;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!previous?.available || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(-1);
  };

  return (
    <Link
      to={previous?.path ?? fallbackTo}
      className="umigame-back-link"
      onClick={handleClick}
    >
      <ArrowLeft size={16} aria-hidden="true" />
      {label}
    </Link>
  );
}
