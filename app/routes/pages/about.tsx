import * as React from "react";
import { PageLayout } from "~/components/layout/PageLayout";
import { PageIntro } from "~/components/layout/PageIntro";
import { aboutContent } from "~/utils/content";
import { siteConfig } from "~/utils/site";

export const meta = () => {
  return [
    { title: `About me | ${siteConfig.fullName}` },
    { name: "description", content: "Roseu のプロフィール" },
  ];
};

export default function AboutPage() {
  const [imageError, setImageError] = React.useState(false);

  return (
    <PageLayout contentClassName="page-stack">
      <PageIntro title="About me" />

      <section className="about-board">
        <section className="about-board__identity">
          <div className="about-board__portrait">
            <div className="about-board__portrait-frame">
              {imageError ? (
                <div className="about-board__fallback">Image coming soon...</div>
              ) : (
                <picture className="about-board__picture">
                  <source srcSet={aboutContent.profileWebp} type="image/webp" />
                  <img
                    src={aboutContent.profilePng}
                    alt={aboutContent.profileAlt}
                    className="about-board__image"
                    height="224"
                    loading="eager"
                    sizes="(max-width: 1023px) 224px, 320px"
                    width="224"
                    onError={() => setImageError(true)}
                  />
                </picture>
              )}
            </div>
          </div>

          <div className="about-board__intro">
            <h2 className="about-board__name">{aboutContent.name}</h2>
            <p className="about-board__copy">{aboutContent.intro}</p>
          </div>
        </section>

        <div className="about-board__details">
          <section className="about-slab">
            <h3 className="content-panel__eyebrow">Skills & Interests</h3>
            <p className="about-board__copy">
              {aboutContent.skills}
              <br />
              {aboutContent.skillList}
            </p>
          </section>

          <section className="about-slab">
            <h3 className="content-panel__eyebrow">Links</h3>
            <div className="about-links" aria-label="Links">
              <a
                href={siteConfig.social.x}
                target="_blank"
                rel="noopener noreferrer"
                className="about-link"
              >
                X / @Roseu_7
              </a>
              <a
                href={siteConfig.social.github}
                target="_blank"
                rel="noopener noreferrer"
                className="about-link"
              >
                GitHub / Roseu7
              </a>
            </div>
          </section>
        </div>
      </section>
    </PageLayout>
  );
}
