interface PageIntroProps {
  title: string;
  description?: string;
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function PageIntro({ title, description }: PageIntroProps) {
  return (
    <section className={cx("page-intro", description && "page-intro--split")}>
      <div className="page-intro__line" aria-hidden="true" />
      <div className="page-intro__headline">
        <h1 className="page-intro__title">{title}</h1>
      </div>
      {description ? (
        <div className="page-intro__summary">
          <p className="page-intro__copy">{description}</p>
        </div>
      ) : null}
    </section>
  );
}
