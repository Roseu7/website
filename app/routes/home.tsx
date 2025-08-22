import * as React from "react";
import { useEffect, useState } from "react";

export const meta = () => {
  return [
    { title: "Digital Sandbox by Roseu" },
    { name: "author", content: "Roseu" },
    { property: "og:title", content: "Digital Sandbox by Roseu" },
    { property: "og:image", content: "https://roseu.net/images/digitalsandbox.webp" },
    { property: "og:url", content: "https://roseu.net" },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Digital Sandbox" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "Digital Sandbox by Roseu" },
    { name: "twitter:image", content: "https://roseu.net/images/digitalsandbox.webp" },
    { name: "twitter:creator", content: "@Roseu_7" },
    { name: "twitter:site", content: "@Roseu_7" },
    { name: "theme-color", content: "#3b82f6" },
    { name: "msapplication-TileColor", content: "#3b82f6" },
  ];
};;

export default function Home() {
  // 画像エラー状態管理
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const handleImageError = (imageName: string) => {
    setImageErrors(prev => new Set([...prev, imageName]));
  };

  useEffect(() => {


    // テーマ切り替え
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');
    const htmlEl = document.documentElement;

    const updateIcons = () => {
      if (htmlEl.classList.contains('dark')) {
        sunIcon?.classList.remove('hidden');
        moonIcon?.classList.add('hidden');
      } else {
        sunIcon?.classList.add('hidden');
        moonIcon?.classList.remove('hidden');
      }
    };

    // テーマ初期化
    const initTheme = () => {
      if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        htmlEl.classList.add('dark');
      } else {
        htmlEl.classList.remove('dark');
      }
    };

    initTheme();
    updateIcons();

    const handleThemeToggle = () => {
      htmlEl.classList.toggle('dark');
      if (htmlEl.classList.contains('dark')) {
        localStorage.setItem('theme', 'dark');
      } else {
        localStorage.setItem('theme', 'light');
      }
      updateIcons();
    };

    themeToggleBtn?.addEventListener('click', handleThemeToggle);

    // スクロールアニメーション
    const header = document.getElementById('main-header');
    const animatedTitle = document.getElementById('animated-title-container');
    const subTitle = document.getElementById('main-subtitle-text');
    const toTopBtn = document.getElementById('to-top-btn');

    let ANIMATION_END = 400;
    const START_SCALE = 1.0;
    const END_SCALE = 0.3;
    const SUBTITLE_VISUAL_START_SCALE = 1.0;
    const SUBTITLE_VISUAL_END_SCALE = 0.65;
    const START_Y_OFFSET = 0;
    let END_Y_OFFSET = -(window.innerHeight / 2) + ((header?.offsetHeight || 0) / 2);
    const SUBTITLE_END_Y_TRANSLATE = 8;

    function calculateAnimationValues() {
      END_Y_OFFSET = -(window.innerHeight / 2) + ((header?.offsetHeight || 0) / 2);
      ANIMATION_END = window.innerHeight * 0.8;
    }

    function handleScroll() {
      const scrollY = window.scrollY;

      if (scrollY > 50) {
        header?.classList.add('scrolled');
      } else {
        header?.classList.remove('scrolled');
      }

      // TOPに戻るボタンの表示制御
      if (scrollY > window.innerHeight / 2) {
        toTopBtn?.classList.remove('opacity-0', 'translate-y-2', 'pointer-events-none');
        toTopBtn?.classList.add('opacity-100', 'translate-y-0', 'pointer-events-auto');
      } else {
        toTopBtn?.classList.add('opacity-0', 'translate-y-2', 'pointer-events-none');
        toTopBtn?.classList.remove('opacity-100', 'translate-y-0', 'pointer-events-auto');
      }

      const progress = Math.min(1, scrollY / ANIMATION_END);

      const currentContainerScale = START_SCALE - (START_SCALE - END_SCALE) * progress;
      const currentY = START_Y_OFFSET + (END_Y_OFFSET - START_Y_OFFSET) * progress;

      // 中央配置の制御
      if (animatedTitle) {
        animatedTitle.style.transform = `translate(-50%, calc(-50% + ${currentY}px)) scale(${currentContainerScale})`;
      }

      const counterScale = 1 / currentContainerScale;
      const targetSubtitleScale = SUBTITLE_VISUAL_START_SCALE - (SUBTITLE_VISUAL_START_SCALE - SUBTITLE_VISUAL_END_SCALE) * progress;
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

    const handleTitleClick = (e: Event) => {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    };

    const handleToTopClick = (e: Event) => {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    };

    animatedTitle?.addEventListener('click', handleTitleClick);
    toTopBtn?.addEventListener('click', handleToTopClick);

    window.addEventListener('scroll', handleScroll);
    const handleResize = () => {
      calculateAnimationValues();
      handleScroll();
    };
    window.addEventListener('resize', handleResize);

    calculateAnimationValues();
    handleScroll();

    // クリーンアップ
    return () => {
      themeToggleBtn?.removeEventListener('click', handleThemeToggle);
      animatedTitle?.removeEventListener('click', handleTitleClick);
      toTopBtn?.removeEventListener('click', handleToTopClick);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <>
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


      <div id="animated-title-container" className="fixed top-1/2 left-1/2 z-50">
        <a href="#" className="block">
          <div className="relative">
            <h2 id="main-title-text" className="text-5xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-500 py-4 theme-transition">
              Digital Sandbox
            </h2>
            <p id="main-subtitle-text" className="knockout-text absolute bottom-4 right-0 text-md font-semibold">
              by Roseu
            </p>
          </div>
        </a>
      </div>

      <main>
        <div className="h-screen"></div>
        <div id="content-area" className="container mx-auto p-8">
          <div className="space-y-32">
            <section id="projects">
              <h3 className="text-3xl font-bold mb-16 text-gray-900 dark:text-white text-center theme-transition">Projects</h3>
              <div className="space-y-24">

                <div className="grid md:grid-cols-2 gap-12 items-center">
                  <div className="project-image-container rounded-lg bg-gray-100 dark:bg-gray-800/50 aspect-video flex items-center justify-center text-gray-400 dark:text-gray-600 theme-transition">
                    {imageErrors.has('valocs') ? (
                      <div className="text-center text-gray-400 dark:text-gray-600">Image coming soon...</div>
                    ) : (
                      <picture>
                        <source srcSet="/images/valocs.webp" type="image/webp" />
                        <img 
                          src="/images/valocs.png" 
                          alt="ばろくす project preview" 
                          className="w-full h-full object-cover rounded-lg" 
                          loading="lazy" 
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw" 
                          width="640" 
                          height="360" 
                          onError={() => handleImageError('valocs')} 
                        />
                      </picture>
                    )}
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 theme-transition">ばろくす</h4>
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-6 space-y-2 theme-transition">
                      <p>VALOrant Custom Support bot</p>
                      <p>ばろくすは、VALORANTのカスタムマッチのためのプレイヤー募集を支援するDiscordボットです。</p>
                      <p>技育ハッカソン2024 Vol.8にて制作しました。</p>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-6">
                      <span className="tech-tag bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-purple-900 dark:text-purple-300 theme-transition">Python</span>
                      <span className="tech-tag bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-indigo-900 dark:text-indigo-300 theme-transition">Discord.py</span>
                      <span className="tech-tag bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-green-900 dark:text-green-300 theme-transition">Supabase</span>
                    </div>
                    <a href="https://github.com/Roseu7/valocs" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white theme-transition">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                      View on GitHub
                    </a>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-12 items-center">
                  <div className="md:order-last project-image-container rounded-lg bg-gray-100 dark:bg-gray-800/50 aspect-video flex items-center justify-center text-gray-400 dark:text-gray-600 theme-transition">
                    {imageErrors.has('botomeru') ? (
                      <div className="text-center text-gray-400 dark:text-gray-600">Image coming soon...</div>
                    ) : (
                      <picture>
                        <source srcSet="/images/botomeru.webp" type="image/webp" />
                        <img 
                          src="/images/botomeru.png" 
                          alt="ぼとめる project preview" 
                          className="w-full h-full object-cover rounded-lg" 
                          loading="lazy" 
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw" 
                          width="640" 
                          height="360" 
                          onError={() => handleImageError('botomeru')} 
                        />
                      </picture>
                    )}
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 theme-transition">ぼとめる</h4>
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-6 space-y-2 theme-transition">
                      <p>日々のふとしたことを誰かに届ける/誰かから受け取るサービスです。ボトルメールのように過去の手紙が流れ着くかもしれません。</p>
                      <p>技育ハッカソン2024 Vol.7にて制作しました。</p>
                      <p>※未完成</p>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-6">
                      <span className="tech-tag bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300 theme-transition">TypeScript</span>
                      <span className="tech-tag bg-cyan-100 text-cyan-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-cyan-900 dark:text-cyan-300 theme-transition">TailwindCSS</span>
                      <span className="tech-tag bg-gray-200 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-gray-700 dark:text-gray-300 theme-transition">Next.js</span>
                      <span className="tech-tag bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-green-900 dark:text-green-300 theme-transition">Supabase</span>
                      <span className="tech-tag bg-black text-white text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-white dark:text-black theme-transition">Vercel</span>
                    </div>
                    <a href="https://github.com/Roseu7/geek0623" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white theme-transition">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                      View on GitHub
                    </a>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-12 items-center">
                  <div className="project-image-container rounded-lg bg-gray-100 dark:bg-gray-800/50 aspect-video flex items-center justify-center text-gray-400 dark:text-gray-600 theme-transition">
                    {imageErrors.has('digitalsandbox') ? (
                      <div className="text-center text-gray-400 dark:text-gray-600">Image coming soon...</div>
                    ) : (
                      <picture>
                        <source srcSet="/images/digitalsandbox.webp" type="image/webp" />
                        <img 
                          src="/images/digitalsandbox.png" 
                          alt="Digital Sandbox project preview" 
                          className="w-full h-full object-cover rounded-lg" 
                          loading="lazy" 
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw" 
                          width="640" 
                          height="360" 
                          onError={() => handleImageError('digitalsandbox')} 
                        />
                      </picture>
                    )}
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 theme-transition">Digital Sandbox</h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 theme-transition">
                      私がやりたい/作ってみたい機能を実際に作成して、記録に残すサイトです。
                    </p>
                    <div className="flex flex-wrap gap-2 mb-6">
                      <span className="tech-tag bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300 theme-transition">TypeScript</span>
                      <span className="tech-tag bg-cyan-100 text-cyan-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-cyan-900 dark:text-cyan-300 theme-transition">TailwindCSS</span>
                      <span className="tech-tag bg-sky-100 text-sky-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-sky-900 dark:text-sky-300 theme-transition">React Router</span>
                      <span className="tech-tag bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-orange-900 dark:text-orange-300 theme-transition">Cloudflare Workers</span>
                    </div>
                    <a href="https://github.com/Roseu7/website" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white theme-transition">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                      View on GitHub
                    </a>
                  </div>
                </div>

              </div>
            </section>

            <hr className="border-t border-gray-200 dark:border-gray-800 theme-transition" />

            <section id="about-me">
              <h3 className="text-3xl font-bold mb-16 text-gray-900 dark:text-white text-center theme-transition">About me</h3>
              <div className="grid md:grid-cols-3 gap-12 items-center">
                <div className="md:col-span-1 flex justify-center">
                  <div className="profile-image-wrapper w-48 h-48 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-600 theme-transition">
                    {imageErrors.has('profile') ? (
                      <div className="text-center text-gray-400 dark:text-gray-600">Image coming soon...</div>
                    ) : (
                      <picture>
                        <source srcSet="/images/profile.webp" type="image/webp" />
                        <img 
                          src="/images/profile.png" 
                          alt="Roseu's profile picture" 
                          className="w-full h-full object-cover rounded-full" 
                          loading="eager" 
                          sizes="192px" 
                          width="192" 
                          height="192" 
                          onError={() => handleImageError('profile')} 
                        />
                      </picture>
                    )}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 theme-transition">ろせ / Roseu</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 theme-transition">
                    2008年頃からパソコンに触れ始め、2013年頃からMinecraftを通してプログラミングに興味を持つ。それ以降、気ままに興味を持った言語でプログラムを作っています。
                  </p>
                  <h5 className="font-bold text-gray-800 dark:text-gray-200 mb-3 theme-transition">Skills & Interests</h5>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 theme-transition">
                    広く浅く、様々な技術に触れるのが好きです。
                    <br />
                    Python, TypeScript, Java, C, etc.
                  </p>
                  <h5 className="font-bold text-gray-800 dark:text-gray-200 mb-3 theme-transition">Links</h5>
                  <div className="flex items-center gap-4">
                    <a href="https://x.com/Roseu_7" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 dark:hover:text-white theme-transition">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.602.75Zm-.86 13.028h1.36L4.323 2.145H2.865z" />
                      </svg>
                    </a>
                    <a href="https://github.com/Roseu7" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 dark:hover:text-white theme-transition">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer className="p-4 sm:p-6">
        <div className="container mx-auto text-center text-sm text-gray-500 dark:text-gray-400 theme-transition">
          <p>&copy; 2025 Roseu. All Rights Reserved.</p>
        </div>
      </footer>

      <a href="#" id="to-top-btn" className="fixed bottom-8 right-8 z-50 p-3 bg-gray-600/50 dark:bg-gray-300/50 text-white dark:text-black rounded-lg shadow-lg hover:bg-gray-700/70 dark:hover:bg-gray-200/70 theme-transition opacity-0 translate-y-2 pointer-events-none">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path>
        </svg>
      </a>
    </>
  );
}
