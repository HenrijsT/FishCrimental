import { linear } from 'svelte/easing';
import { tweened } from 'svelte/motion';
import { fishAction } from './fish_types';

export const progressBar = tweened(1000, {
	duration: 5000,
	easing: linear
});
let timer: number;

export const handleMouseDown = () => {
	progressBar.set(0, { duration: 0 });
	progressBar.set(1000);
	timer = setInterval(() => {
		progressBar.set(0, { duration: 0 });
		progressBar.set(1000);
		fishAction();
	}, 5000);
};

export const handleMouseUp = () => {
	clearInterval(timer);
	progressBar.set(0);
};
