import type { ReactNode } from "react";
import { Link, useRouteLoaderData } from "react-router";

interface LegalConsentCheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  children?: ReactNode;
}

export function LegalConsentCheckbox({
  id,
  checked,
  onChange,
  error,
  children,
}: LegalConsentCheckboxProps) {
  const rootData = useRouteLoaderData("root") as
    | { legalBaseHref?: string }
    | undefined;
  const legalBaseHref = rootData?.legalBaseHref ?? "";
  const errorId = `${id}-error`;

  return (
    <div className="legal-consent">
      <label className="legal-consent__label">
        <input
          id={id}
          className="legal-consent__checkbox"
          type="checkbox"
          name="legalConsent"
          value="yes"
          checked={checked}
          onChange={(event) => onChange(event.currentTarget.checked)}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <span>
          <Link to={`${legalBaseHref}/terms`}>利用規約</Link>を契約の内容とすることに同意し、
          <Link to={`${legalBaseHref}/privacy`}>プライバシーポリシー</Link>の内容にも同意します。
          {children ? <> {children}</> : null}
        </span>
      </label>
      {error ? (
        <small id={errorId} className="legal-consent__error" role="alert">
          {error}
        </small>
      ) : null}
    </div>
  );
}
