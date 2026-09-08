import * as React from "react";
import { GitHubMark } from "~/components/icons/GitHubMark";
import { PageLayout } from "~/components/layout/PageLayout";
import { PageIntro } from "~/components/layout/PageIntro";
import { projects } from "~/utils/content";
import { siteConfig } from "~/utils/site";

export const meta = () => {
  return [
    { title: `Projects | ${siteConfig.fullName}` },
    { name: "description", content: "制作したプロジェクト一覧" },
  ];
};

export default function ProjectsPage() {
  const [imageErrors, setImageErrors] = React.useState<Set<string>>(new Set());

  const handleImageError = (imageName: string) => {
    setImageErrors((prev) => new Set([...prev, imageName]));
  };

  return (
    <PageLayout contentClassName="page-stack">
      <PageIntro title="Projects" />

      <section className="projects-board">
        {projects.map((project, index) => {
          const hasImageError = imageErrors.has(project.id);

          return (
            <article
              key={project.id}
              className={`project-sheet${index % 2 === 1 ? " project-sheet--alt" : ""}`}
            >
              <div className="project-sheet__index" aria-hidden="true" />

              <div className="project-sheet__body">
                <h2 className="project-sheet__title">{project.title}</h2>

                <div className="project-sheet__copy">
                  {project.description.map((line) => (
                    <p key={`${project.id}-${line}`}>{line}</p>
                  ))}
                </div>

                <div className="tag-row">
                  {project.stack.map((item) => (
                    <span
                      key={`${project.id}-${item.label}`}
                      className={`badge tech-tag tech-tag--${item.tone}`}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>

                {project.repoVisibility === "public" ? (
                  <a
                    href={project.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn cta-link"
                  >
                    <GitHubMark />
                    <span>GitHubで見る</span>
                  </a>
                ) : (
                  <span
                    className="btn cta-link cta-link--danger"
                    aria-disabled="true"
                  >
                    <GitHubMark />
                    <span>GitHub非公開</span>
                  </span>
                )}
              </div>

              <div className="project-sheet__media">
                {hasImageError ? (
                  <div className="project-sheet__fallback">Image coming soon...</div>
                ) : (
                  <picture className="project-sheet__picture">
                    <source srcSet={project.imageWebp} type="image/webp" />
                    <img
                      src={project.imagePng}
                      alt={project.alt}
                      className="project-sheet__image"
                      height="360"
                      loading="lazy"
                      sizes="(max-width: 768px) 100vw, (max-width: 1180px) 50vw, 44vw"
                      width="640"
                      onError={() => handleImageError(project.id)}
                    />
                  </picture>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </PageLayout>
  );
}
