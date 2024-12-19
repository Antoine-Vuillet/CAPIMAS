describe("La page s'ouvre correctement", () => {
  it('passes', () => {
    cy.visit('http://localhost:3000')
  })
})

const cards_values =[
  "1",
  "2",
  "3",
  "5",
  "8",
  "13",
  "20",
  "40",
  "100",
  "?",
  "☕ Café"
]


//Test de la création d'une salle et du vote de chaque fonctionnalitée
describe("Création d'une salle et vote des fonctionnalitées", () => {
  it('passes', () => {
    cy.visit('http://localhost:3000');
    cy.get('#roomNameInput').type("test");
    cy.get('#maxPlayersInput').type("1");
    cy.get('#usernameInput').type("test1");
    cy.get('#backlogInput').selectFile("./cypress/e2e/test_configs/backlog-test.json");
    cy.get('#createRoomBtn').click();
    cy.get('#roomNameDisplay').contains("test");
    for(let i=0; i<cards_values.length;i++){
      cy.get('.cardBtn:nth-child('+Number(i+1)+')').contains(cards_values[i]);
    }
      
    for(let i = 0;i<10;i++){
      cy.get('.cardBtn:nth-child('+Number(i+1)+')').click();
      cy.get('#swal2-html-container').contains('La fonctionnalité "Task'+Number(i+1)+'" a été estimée à '+cards_values[i]+'.');
      cy.get('.swal2-confirm').click();
    }
    cy.get('.cardBtn:nth-child(1)').click();
    cy.get('#swal2-html-container').contains('Le backlog a été entièrement estimé. Les résultats ont été sauvegardés.');
    cy.get('.swal2-confirm').click();
  })
})


