import { Link } from "react-router";
import { useEffect } from "react";
import { HandwritingTitle } from "~/components/HandwritingTitle";
import { attachThemeToggle } from "~/utils/theme";

export const meta = () => {
  return [
    { title: "404 Not Found | Digital Sandbox by Roseu" },
    { name: "robots", content: "noindex, nofollow" },
    { property: "og:title", content: "404 Not Found | Digital Sandbox by Roseu" },
    { property: "og:type", content: "website" },
  ];
};

export default function NotFound() {
  useEffect(() => {
    // テーマ切り替え
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');
    const detachThemeToggle = attachThemeToggle({
      button: themeToggleBtn,
      sunIcon,
      moonIcon
    });

    // スクロール状態を最終表示に固定
    const header = document.getElementById('main-header');
    const animatedTitle = document.getElementById('animated-title-container');
    const subTitle = document.getElementById('main-subtitle-text');

    let ANIMATION_END = 400;
    const START_SCALE = 1.0;
    const END_SCALE = 0.3;
    const SUBTITLE_VISUAL_START_SCALE = 1.0;
    let subtitleVisualEndScale = window.innerWidth <= 768 ? 0.5 : 0.65;
    const START_Y_OFFSET = 0;
    let END_Y_OFFSET = -(window.innerHeight / 2) + ((header?.offsetHeight || 0) / 2);
    const SUBTITLE_END_Y_TRANSLATE = 8;

    function calculateAnimationValues() {
      END_Y_OFFSET = -(window.innerHeight / 2) + ((header?.offsetHeight || 0) / 2);
      ANIMATION_END = window.innerHeight * 0.8;
      subtitleVisualEndScale = window.innerWidth <= 768 ? 0.5 : 0.65;
    }

    function handleScrollFixed() {
      const scrollY = ANIMATION_END;

      if (scrollY > 50) {
        header?.classList.add('scrolled');
      } else {
        header?.classList.remove('scrolled');
      }


      const progress = Math.min(1, scrollY / ANIMATION_END);

      const currentContainerScale = START_SCALE - (START_SCALE - END_SCALE) * progress;
      const currentY = START_Y_OFFSET + (END_Y_OFFSET - START_Y_OFFSET) * progress;

      if (animatedTitle) {
        animatedTitle.style.transform = `translate(-50%, calc(-50% + ${currentY}px)) scale(${currentContainerScale})`;
      }

      const counterScale = 1 / currentContainerScale;
      const targetSubtitleScale = SUBTITLE_VISUAL_START_SCALE - (SUBTITLE_VISUAL_START_SCALE - subtitleVisualEndScale) * progress;
      const currentSubtitleY = SUBTITLE_END_Y_TRANSLATE * progress;

      if (subTitle) {
        subTitle.style.transform = `scale(${counterScale * targetSubtitleScale}) translateY(${currentSubtitleY}px)`;
        subTitle.style.transformOrigin = 'bottom right';
      }

      if (animatedTitle) {
        if (scrollY > 50) {
          animatedTitle.style.pointerEvents = 'auto';
        } else {
          animatedTitle.style.pointerEvents = 'none';
        }
      }
    }

    const handleResize = () => {
      calculateAnimationValues();
      handleScrollFixed();
    };
    window.addEventListener('resize', handleResize);

    calculateAnimationValues();
    handleScrollFixed();

    // クリーンアップ
    return () => {
      detachThemeToggle();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header id="main-header" className="fixed top-0 left-0 w-full p-4 sm:p-6 z-40">
        <div className="container mx-auto flex justify-end items-center relative h-10">
          <button
            id="theme-toggle-btn"
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none theme-transition"
          >
            <span className="sr-only">Toggle theme</span>
            <svg
              id="moon-icon"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
            <svg
              id="sun-icon"
              className="h-6 w-6 hidden"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" 
              />
            </svg>
          </button>
        </div>
      </header>

      <div id="animated-title-container" className="fixed top-1/2 left-1/2 z-50 logo-entrance">
        <Link to="/" className="block">
          <div className="relative text-center">
            <HandwritingTitle />
            <p id="main-subtitle-text" className="absolute bottom-4 right-0 text-md font-semibold theme-transition logo-subtitle-script">
              by Roseu
            </p>
          </div>
        </Link>
      </div>

      <main className="flex-1 flex items-center justify-center">
        <div id="content-area" className="container mx-auto p-8">
          <section className="text-center">
            <h3 className="text-6xl md:text-8xl font-bold text-gray-900 dark:text-white mb-8 theme-transition">404 Not Found</h3>
            <p className="text-lg text-gray-500 dark:text-gray-400 mb-8 theme-transition">
              お探しのページは見つかりませんでした。
            </p>
            <Link
              to="/"
              className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg theme-transition"
            >
              トップページに戻る
            </Link>
          </section>
        </div>
      </main>

      <footer className="p-4 sm:p-6">
        <div className="container mx-auto text-center text-sm text-gray-500 dark:text-gray-400 theme-transition">
          <p>&copy; 2026 Roseu. All Rights Reserved.</p>
        </div>
      </footer>

    </div>
  );
}

// ルート単位のエラーバウンダリー
export function ErrorBoundary() {
  return <NotFound />;
}
