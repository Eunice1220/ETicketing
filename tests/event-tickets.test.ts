import { describe, it, beforeEach, expect } from 'vitest';
import {
  Client,
  Provider,
  ProviderRegistry,
  Result,
} from '@blockstack/clarity';

describe('event-tickets contract test suite', () => {
  let client: Client;
  let provider: Provider;
  
  const CONTRACT_NAME = 'event-tickets';
  const DEPLOYER_ADDRESS = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
  const USER1_ADDRESS = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
  const USER2_ADDRESS = 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC';
  
  beforeEach(async () => {
    provider = await ProviderRegistry.createProvider();
    client = new Client(CONTRACT_NAME, DEPLOYER_ADDRESS, provider);
    await client.deployContract();
  });
  
  describe('Deployment', () => {
    it('should deploy successfully', async () => {
      const receipt = await client.deployContract();
      expect(receipt.success).toBe(true);
    });
  });
  
  describe('Event Creation', () => {
    it('should create an event successfully', async () => {
      const result = await client.createEvent({
        sender: DEPLOYER_ADDRESS,
        args: [
          'Concert 2024',           // name
          'Annual music festival',  // description
          'Central Park',           // venue
          '1735689600',            // date (Unix timestamp)
          '100000000',             // price (100 STX)
          '1000'                   // total supply
        ]
      });
      
      expect(result.success).toBe(true);
      const eventId = result.value;
      expect(eventId).toBe(1);
      
      const event = await client.getEvent(eventId);
      expect(event.name).toBe('Concert 2024');
      expect(event.totalSupply).toBe(1000);
      expect(event.ticketsSold).toBe(0);
    });
    
    it('should fail to create event with invalid parameters', async () => {
      const result = await client.createEvent({
        sender: DEPLOYER_ADDRESS,
        args: [
          '',                      // empty name
          'Description',
          'Venue',
          '1735689600',
          '100000000',
          '0'                      // invalid supply
        ]
      });
      
      expect(result.success).toBe(false);
    });
  });
  
  describe('Ticket Purchase', () => {
    beforeEach(async () => {
      // Create an event before each test
      await client.createEvent({
        sender: DEPLOYER_ADDRESS,
        args: [
          'Test Event',
          'Test Description',
          'Test Venue',
          '1735689600',
          '100000000',
          '100'
        ]
      });
    });
    
    it('should purchase ticket successfully', async () => {
      const result = await client.purchaseTicket({
        sender: USER1_ADDRESS,
        args: ['1']  // event ID
      });
      
      expect(result.success).toBe(true);
      
      const ticket = await client.getTicket(result.value);
      expect(ticket.owner).toBe(USER1_ADDRESS);
      expect(ticket.status).toBe('active');
    });
    
    it('should fail when event is sold out', async () => {
      // Create event with 1 ticket
      await client.createEvent({
        sender: DEPLOYER_ADDRESS,
        args: ['Sold Out Event', 'Description', 'Venue', '1735689600', '100000000', '1']
      });
      
      // Purchase the only ticket
      await client.purchaseTicket({
        sender: USER1_ADDRESS,
        args: ['2']
      });
      
      // Try to purchase another ticket
      const result = await client.purchaseTicket({
        sender: USER2_ADDRESS,
        args: ['2']
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('err-sold-out');
    });
  });
  
  describe('Ticket Transfer', () => {
    let ticketId: number;
    
    beforeEach(async () => {
      // Create event and purchase ticket
      await client.createEvent({
        sender: DEPLOYER_ADDRESS,
        args: ['Transfer Test', 'Description', 'Venue', '1735689600', '100000000', '100']
      });
      
      const purchaseResult = await client.purchaseTicket({
        sender: USER1_ADDRESS,
        args: ['1']
      });
      ticketId = purchaseResult.value;
    });
    
    it('should transfer ticket successfully', async () => {
      const result = await client.transferTicket({
        sender: USER1_ADDRESS,
        args: [ticketId.toString(), USER2_ADDRESS]
      });
      
      expect(result.success).toBe(true);
      
      const ticket = await client.getTicket(ticketId);
      expect(ticket.owner).toBe(USER2_ADDRESS);
    });
    
    it('should fail when non-owner attempts transfer', async () => {
      const result = await client.transferTicket({
        sender: USER2_ADDRESS,  // not the owner
        args: [ticketId.toString(), USER2_ADDRESS]
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('err-unauthorized');
    });
  });
  
  describe('Ticket Usage', () => {
    let ticketId: number;
    
    beforeEach(async () => {
      // Create event and purchase ticket
      await client.createEvent({
        sender: DEPLOYER_ADDRESS,
        args: ['Usage Test', 'Description', 'Venue', '1735689600', '100000000', '100']
      });
      
      const purchaseResult = await client.purchaseTicket({
        sender: USER1_ADDRESS,
        args: ['1']
      });
      ticketId = purchaseResult.value;
    });
    
    it('should mark ticket as used successfully', async () => {
      const result = await client.useTicket({
        sender: USER1_ADDRESS,
        args: [ticketId.toString()]
      });
      
      expect(result.success).toBe(true);
      
      const ticket = await client.getTicket(ticketId);
      expect(ticket.status).toBe('used');
    });
    
    it('should fail to use ticket twice', async () => {
      // Use ticket first time
      await client.useTicket({
        sender: USER1_ADDRESS,
        args: [ticketId.toString()]
      });
      
      // Attempt to use ticket second time
      const result = await client.useTicket({
        sender: USER1_ADDRESS,
        args: [ticketId.toString()]
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('err-unauthorized');
    });
  });
  
  describe('Administrative Functions', () => {
    it('should allow owner to set royalty percentage', async () => {
      const result = await client.setRoyaltyPercentage({
        sender: DEPLOYER_ADDRESS,
        args: ['10']  // 10%
      });
      
      expect(result.success).toBe(true);
    });
    
    it('should prevent non-owner from setting royalty percentage', async () => {
      const result = await client.setRoyaltyPercentage({
        sender: USER1_ADDRESS,  // not the owner
        args: ['10']
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('err-owner-only');
    });
  });
  
  describe('Read-Only Functions', () => {
    beforeEach(async () => {
      // Create event and purchase ticket
      await client.createEvent({
        sender: DEPLOYER_ADDRESS,
        args: ['Read Test', 'Description', 'Venue', '1735689600', '100000000', '100']
      });
      
      await client.purchaseTicket({
        sender: USER1_ADDRESS,
        args: ['1']
      });
    });
    
    it('should get event details correctly', async () => {
      const event = await client.getEvent('1');
      expect(event).toBeDefined();
      expect(event.name).toBe('Read Test');
      expect(event.ticketsSold).toBe(1);
    });
    
    it('should get ticket details correctly', async () => {
      const ticket = await client.getTicket('1');
      expect(ticket).toBeDefined();
      expect(ticket.owner).toBe(USER1_ADDRESS);
      expect(ticket.status).toBe('active');
    });
    
    it('should get correct ticket owner', async () => {
      const owner = await client.getTicketOwner('1');
      expect(owner).toBe(USER1_ADDRESS);
    });
    
    it('should get correct number of tickets sold', async () => {
      const ticketsSold = await client.getTicketsSold('1');
      expect(ticketsSold).toBe(1);
    });
  });
});
