/* eslint-disable @next/next/no-img-element */
import { useLocalStorage } from '@mantine/hooks';
import { useMemo } from 'react';
import { LiveNowIndicator } from '~/components/Social/LiveNow';
import { getThanksgivingDate } from '~/utils/date-helpers';
import { NextLink } from '~/components/NextLink/NextLink';
import clsx from 'clsx';
import styles from './Logo.module.scss';

const gradients = {
  blue: {
    inner: ['#081692', '#1E043C'],
    outer: ['#1284F7', '#0A20C9'],
  },
  green: {
    inner: ['#081692', '#1E043C'],
    outer: ['#1284F7', '#0A20C9'],
  },
  halloween: {
    inner: ['#926711', '#3C1F0E'],
    outer: ['#F78C22', '#C98C17'],
  },
  christmas: {
    inner: ['#126515', '#070F0C'],
    outer: ['#45A72A', '#377B39'],
  },
  newyear: {
    inner: ['#081692', '#1E043C'],
    outer: ['#1284F7', '#0A20C9'],
  },
  stpatty: {
    inner: ['#135F20', '#020709'],
    outer: ['#53C42B', '#1D962F'],
  },
  pride: {
    inner: ['#746A11', '#2A7911', '#117642', '#106A71', '#0E145E', '#200D57'],
    outer: ['#E04A4A', '#E04A4A', '#E0B54A', '#4AE0D4', '#4A6AE0', '#D44AE0'],
  },
};

const today = new Date();
const year = today.getFullYear();
const month = today.getMonth();
const day = today.getDate();
const thanksgivingDay = getThanksgivingDate(year).getDate();

export function Logo() {
  const [showHoliday] = useLocalStorage({ key: 'showDecorations', defaultValue: true });
  const holiday = useMemo(() => {
    if (!showHoliday) return null;

    // Halloween
    if (month === 9) return 'halloween';

    // Christmas
    if ((month === 10 && day >= thanksgivingDay) || (month === 11 && day <= 25)) return 'christmas';

    // New Year (no styles)
    if (month === 11 && day >= 26) return null;

    // St. Patrick's Day
    if (month === 2 && day >= 14 && day <= 17) return 'stpatty';

    // Pride
    if (month === 5) return 'pride';

    return null;
  }, [showHoliday]);

  const holidayClass = holiday ? styles[holiday] : null;
  const innerGradient = holiday ? gradients[holiday].inner : gradients.blue.inner;
  const outerGradient = holiday ? gradients[holiday].outer : gradients.blue.outer;

  return (
    <div className={clsx(styles.logo, holidayClass)}>
      <NextLink href="/">
        {holiday === 'halloween' && (
          <img src="/images/holiday/ghost.png" alt="ghost" className={styles.flyOver} />
        )}
        {holiday === 'christmas' && (
          <>
            <img src="/images/holiday/santa-hat.png" alt="santa hat" className={styles.hat} />
            <div className={styles.deer}>
              <img src="/images/holiday/deer.png" alt="deer" id="deer" />
              <img
                src="/images/holiday/deer-nose.png"
                alt="deer nose"
                id="nose"
                className={styles.nose}
              />
              <img
                src="/images/holiday/deer-glow.png"
                alt="deer glow"
                id="glow"
                className={styles.glow}
              />
            </div>
          </>
        )}
        {/* mobile svg */}
        <svg
          className={clsx(styles.svg, '@sm:hidden')}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="-1 0 22.7 22.7"
        >
          <g>
            {holiday === 'pride' ? (
              <>
                <linearGradient id="innerGradient" gradientTransform="rotate(45)">
                  {generatePrideGradient(gradients.pride.inner)}
                </linearGradient>
                <linearGradient id="outerGradient" gradientTransform="rotate(45)">
                  {generatePrideGradient(gradients.pride.outer)}
                </linearGradient>
              </>
            ) : (
              <>
                <linearGradient
                  id="innerGradient"
                  gradientUnits="userSpaceOnUse"
                  x1="10.156"
                  y1="22.45"
                  x2="10.156"
                  y2="2.4614"
                  gradientTransform="matrix(1 0 0 -1 0 24)"
                >
                  <stop offset="0" style={{ stopColor: innerGradient[0] }} />
                  <stop offset="1" style={{ stopColor: innerGradient[1] }} />
                </linearGradient>
                <linearGradient
                  id="outerGradient"
                  gradientUnits="userSpaceOnUse"
                  x1="10.156"
                  y1="22.45"
                  x2="10.156"
                  y2="2.45"
                  gradientTransform="matrix(1 0 0 -1 0 24)"
                >
                  <stop offset="0" style={{ stopColor: outerGradient[0] }} />
                  <stop offset="1" style={{ stopColor: outerGradient[1] }} />
                </linearGradient>
              </>
            )}
            <path
              style={{ fill: 'url(#innerGradient)' }}
              d="M1.5,6.6v10l8.7,5l8.7-5v-10l-8.7-5L1.5,6.6z"
            />
            <path
              style={{ fill: 'url(#outerGradient)' }}
              d="M10.2,4.7l5.9,3.4V15l-5.9,3.4L4.2,15V8.1
		L10.2,4.7 M10.2,1.6l-8.7,5v10l8.7,5l8.7-5v-10C18.8,6.6,10.2,1.6,10.2,1.6z"
            />
            <path
              style={{ fill: '#fff' }}
              d="M11.8,12.4l-1.7,1l-1.7-1v-1.9l1.7-1l1.7,1h2.1V9.3l-3.8-2.2L6.4,9.3v4.3l3.8,2.2l3.8-2.2v-1.2H11.8z"
            />
          </g>
        </svg>

        {/* desktop svg */}
        <svg
          className={clsx(styles.svg, '@max-sm:hidden')}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 107 22.7"
        >
          <defs>
            <linearGradient id="prideGradient" gradientTransform="rotate(45)">
              {generatePrideGradient(gradients.pride.outer)}
            </linearGradient>
          </defs>
          <g>
            <path
              className={styles.c}
              d="M20.8,1.7H3.7L1.5,4.1v15l2.3,2.3h17.1v-5.2H6.7V7h14.1V1.7z"
            />
            <path
              className={styles.ivit}
              d="M76.1,1.7H56.6V7h7.2v14.3H69V7h7C76,7,76.1,1.7,76.1,1.7z M23.2,1.8v19.5h5.2V1.8C28.4,1.8,23.2,1.8,23.2,1.8z M30.8,1.8
      v19.5h7.6l8.3-8.3V1.8h-5.2v8.3l-5.4,6V1.8C36.1,1.8,30.8,1.8,30.8,1.8z M49.1,1.8v19.5h5.2V1.8C54.3,1.8,49.1,1.8,49.1,1.8z"
            />
            <path
              className={styles.ai}
              d="M100.3,1.8v19.5h5.2V1.8H100.3z M95.6,1.8H80.8l-2.3,2.3v17.2h5.2v-7.1h8.9v7.1h5.2V4.1C97.8,4.1,95.6,1.8,95.6,1.8z
      M92.7,8.9h-8.9V7h8.9V8.9z"
            />
            <path className={styles.accent} d="M46.7,16.2v5.1h-5.1" />
          </g>
        </svg>
      </NextLink>
      <LiveNowIndicator className={styles.liveNow} />
    </div>
  );
}

const generatePrideGradient = (colors: string[]) => {
  const stops = colors.map((color, index) => {
    const offset = (index / (colors.length - 1)) * 100;
    return <stop key={index} offset={`${offset}%`} stopColor={color} />;
  });
  return stops;
};
