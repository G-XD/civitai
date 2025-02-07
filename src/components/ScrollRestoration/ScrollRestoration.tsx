import { useEffect } from 'react';
import { create } from 'zustand';
import Router from 'next/router';
import { createKeyDebouncer } from '~/utils/debouncer';
import { EventEmitter } from '~/utils/eventEmitter';
import { ExponentialBackoff } from '~/utils/exponentialBackoff';

type ScrollPosition = { scrollTop: number; scrollLeft: number };
const scrollMap = new Map<string, ScrollPosition>();

const debounce = createKeyDebouncer(300);

const emitter = new EventEmitter<{ scroll: ScrollPosition & { key: string } }>();
emitter.on('scroll', ({ key, ...scrollPosition }) => {
  debounce(key, () => scrollMap.set(key, scrollPosition));
});

type ScrollOptions = {
  key: string;
  defaultPosition?: 'top' | 'bottom';
};
// #endregion

// #region [global state]
const useScrollOptions = create<ScrollOptions | undefined>(() => undefined);
// #endregion

export const usePageScrollRestore = ({
  key,
  defaultPosition = 'top',
  condition,
}: ScrollOptions & { condition?: boolean }) => {
  useEffect(() => {
    if (condition === undefined || condition) {
      useScrollOptions.setState({ key, defaultPosition });
    }
  }, [condition, key, defaultPosition]);
};

export function ScrollRestoration() {
  useEffect(() => {
    history.scrollRestoration = 'manual';

    let ignoreScrollEvents = false;
    let backoff: ExponentialBackoff | undefined;
    const node = document.querySelector('html');
    let key = history.state.key;

    const handleRouteChangeComplete = () => {
      key = history.state.key;
      ignoreScrollEvents = true;
      const record = scrollMap.get(key);
      if (record) {
        backoff = new ExponentialBackoff({
          startingDelay: 50,
          growthFactor: 1,
          maxAttempts: 10,
          resolve: () => !!useScrollOptions.getState(),
        });
        backoff.execute(() => {
          if (node) {
            if (node.scrollTop === record.scrollTop && node.scrollLeft === record.scrollLeft) {
              backoff?.abort();
            } else {
              ignoreScrollEvents = true;

              node.scrollTop = record.scrollTop;
              node.scrollLeft = record.scrollLeft;
            }
          }
        });
      }
    };

    const handleScroll = () => {
      if (node) {
        if (ignoreScrollEvents) {
          ignoreScrollEvents = false;
        } else {
          backoff?.abort();
          emitter.emit('scroll', {
            key,
            scrollTop: node.scrollTop,
            scrollLeft: node.scrollLeft,
          });
        }
      }
    };

    useScrollOptions.subscribe((options) => {
      if (!options || !node) return;
      key = `${history.state.key}_${options.key}`;
      const record = scrollMap.get(key);
      ignoreScrollEvents = true;
      if (!record) {
        switch (options.defaultPosition) {
          case 'top': {
            if (node.scrollTop !== 0) node.scrollTop = 0;
            break;
          }
          case 'bottom': {
            const scrollBottom = node.scrollHeight - node.clientHeight;
            if (node.scrollTop < scrollBottom) node.scrollTop = scrollBottom;
            break;
          }
        }
      } else {
        node.scrollTop = record.scrollTop;
        node.scrollLeft = record.scrollLeft;
      }
    });

    addEventListener('scroll', handleScroll, { passive: true });
    Router.events.on('routeChangeComplete', handleRouteChangeComplete);
    return () => {
      removeEventListener('scroll', handleScroll);
      Router.events.off('routeChangeComplete', handleRouteChangeComplete);
    };
  }, []);

  return null;
}
