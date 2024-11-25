let currentcard, allchoices, allcards;

function init(){
    allcards =document.getElementsByClassName("card"); 
    for (i = 0; i < allcards.length; i++) {
        allcards[i].addEventListener("click", chosecard)
    }
    setTimeout(timeout, 30000)
}

function chosecard(){
    currentcard = evt.target.innerHTML
}

function timeout(){
    allcards.push(currentcard)
    window.location.replace('result.html');

}

window.onload = function(){init();}