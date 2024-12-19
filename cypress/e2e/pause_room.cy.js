//Test de la création d'une salle et de l'activation de la pause
describe("Création d'une salle et vote des fonctionnalitées", () => {
    it('passes', () => {
      cy.visit('http://localhost:3000');
      cy.get('#roomNameInput').type("test");
      cy.get('#maxPlayersInput').type("1");
      cy.get('#usernameInput').type("test1");
      cy.get('#backlogInput').selectFile("./cypress/e2e/test_configs/backlog-test.json");
      cy.get('#createRoomBtn').click();
      cy.get('#roomNameDisplay').contains("test");
      cy.get('.cardBtn:nth-child(11)').click();
      cy.get('#swal2-html-container').contains('Tous les joueurs ont choisi "Café". La partie est sauvegardée.');

      cy.get('.swal2-confirm').click();
      for(let i=0; i<11;i++){
        cy.get('.cardBtn:nth-child('+Number(i+1)+')').should('be.disabled');
      }
    })
  })