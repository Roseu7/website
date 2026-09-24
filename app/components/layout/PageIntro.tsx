interface PageIntroProps {
  title: string;
  description?: string;
  headingLevel?: "h1" | "h2";
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function PageIntro({ title, description, headingLevel = "h1" }: PageIntroProps) {
  const Heading = headingLevel;

  return (
    <section className={cx("page-intro", description && "page-intro--split")}>
      <div className="page-intro__line" aria-hidden="true" />
      <div className="page-intro__headline">
        <Heading className="page-intro__title">{title}</Heading>
      </div>
      {description ? (
        <div className="page-intro__summary">
          <p className="page-intro__copy">{description}</p>
        </div>
      ) : null}
    </section>
  );
}
