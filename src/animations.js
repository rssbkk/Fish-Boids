import { gsap } from "gsap";
import { materialOpacity } from "three/examples/jsm/nodes/Nodes.js";

// Ensure the DOM content is fully loaded before running scripts
document.addEventListener('DOMContentLoaded', function() {
    
    // GSAP animations
    const optionsButton = document.querySelector("#optionsButton");
    const watchButton = document.querySelector("#watchButton");
    const menuButton = document.querySelector("#menuButton");
    const accountButton = document.querySelector("#accountButton");
    const container = document.querySelector("#container");
    const options = document.querySelector("#options");

    // Initially, position the options to the right outside of the viewport
    gsap.set(options, { x: '200%' });
    gsap.set(menuButton, { x: '-200%' });

    // Create timelines
    const mainTimeline = gsap.timeline({ paused: true });
    const optionsTimeline = gsap.timeline({ paused: true });
    const hideUITimeline = gsap.timeline({ paused: true });

    // Main Menu Timeline
    mainTimeline
        .to(container, {
            y: '100%',
            duration: 0.5, 
            ease: "power1.in"
        })
        .to(optionsButton, {
          y: '-200%',
          duration: 0.5, 
          ease: "power1.in"
        }, ">-0.25")
        .to(options, {
            x: '100%',
            duration: 0.5, 
            ease: "power1.out"
        }, "<")
        .to(menuButton, {
            x: '0%',
            duration: 0.5, 
            ease: "elastic.in(1,0.4)"
        }, "-=0.5")
        .to(watchButton, {
            x: '400%',
            duration: 0.5, 
            ease: "elastic.in(1,0.4)"
        }, ">-=0.5")
        .to(accountButton, {
            x: '200%',
            duration: 0.5, 
            ease: "elastic.in(1,0.4)"
        }, ">-=0.5");

    // Options Menu Timeline
    optionsTimeline
        .to(menuButton, {
            x: '-200%',
            duration: 0.5, 
            ease: "power1.out"
        })
        .to(watchButton, {
          x: '0%',
          duration: 0.5, 
          ease: "elastic.out(1,0.4)"
        }, ">-=0.5")
        .to(accountButton, {
          x: '0%',
          duration: 0.5, 
          ease: "elastic.out(1,0.4)"
        }, ">-=0.5")
        .to(optionsButton, {
          y: '0%',
          duration: 0.5, 
          ease: "power1.in"
        })
        .to(options, {
            x: '200%',
            duration: 0.5, 
            ease: "power1.in"
        }) // "<" means this animation starts at the same time as the previous one ends
        .to(container, {
            y: '0%',
            duration: 0.5, 
            ease: "elastic.out(0.8,1)"
        }, "-=0.25"); // "-=0.25" means this animation starts 0.25 seconds before the previous one ends

    // Hide UI Timeline
    hideUITimeline
        .to( [container, accountButton, options], {
          opacity: 0,
          duration: 1
        })

    // Event listeners for buttons
    optionsButton.addEventListener('click', function() {
        mainTimeline.restart();
    });

    menuButton.addEventListener('click', function() {
        optionsTimeline.restart();
    });
    
    let hidden = false;

    watchButton.addEventListener('click', function() {
      if(!hidden) {
        hideUITimeline.restart()
        hidden = true;
      } else {
        hideUITimeline.reverse()
        hidden = false;
      }
    });

    window.addEventListener('click', function(event) {
      if (hidden && !watchButton.contains(event.target)) {
        hideUITimeline.reverse();
        hidden = false;
      }
    });
});