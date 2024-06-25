import { gsap } from "gsap";

// Ensure the DOM content is fully loaded before running scripts
document.addEventListener('DOMContentLoaded', function() {
    
    // GSAP animations
    const optionsButton = document.querySelector("#buttonContainer button:nth-child(2)");
    const menuButton = document.querySelector("#menuButton");
    const container = document.querySelector("#container");
    const options = document.querySelector("#options");

    // Initially, position the options to the right outside of the viewport
    gsap.set(options, { x: '200%' });
    gsap.set(menuButton, { y: '-200%' });

    function menuOff() {
        return gsap.to(container, {
          y: '100%',
          duration: 0.5, 
          ease: "power1.in" 
        });
      }
  
      function menuOn() {
        return gsap.to(container, {
          y: '0%',
          duration: 0.5, 
          ease: "elastic.out(0.8,1)" 
        });
      }
  
      function optionsOff() {
        return gsap.to(options, {
          x: '200%',
          duration: 0.5, 
          ease: "power1.in" 
        });
      }
  
      function optionsOn() {
        return gsap.to(options, {
          x: '100%',
          duration: 0.5, 
          ease: "power1.out" 
        });
      }
      
      function backOn() {
        return gsap.to(menuButton, {
          y: '0%',
          duration: 0.5, 
          ease: "elastic.out(1,0.3)",
        });
      }
      function backOff() {
        return gsap.to(menuButton, {
          y: '-200%',
          duration: 0.5, 
          ease: "power1.out"
        });
      }
  
      // Event listeners for buttons
      optionsButton.addEventListener('click', function() {
        menuOff().then(() => {
          optionsOn().then(() => {
            backOn();
          });
        });
      });

    menuButton.addEventListener('click', function() {
        Promise.all([backOff(), optionsOff()]).then(() => {
            menuOn();
        });
    });
});