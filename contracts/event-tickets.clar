;; event-tickets.clar
;; Implements NFT-based event ticketing system

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-already-exists (err u102))
(define-constant err-invalid-price (err u103))
(define-constant err-unauthorized (err u104))
(define-constant err-sold-out (err u105))

;; Data Variables
(define-data-var royalty-percentage uint u5) ;; 5% default royalty

;; NFT Definition
(define-non-fungible-token event-ticket uint)

;; Data Maps
(define-map events
    uint
    { name: (string-ascii 100),
      description: (string-ascii 500),
      venue: (string-ascii 100),
      date: uint,
      price: uint,
      total-supply: uint,
      tickets-sold: uint,
      organizer: principal })

(define-map tickets
    uint
    { event-id: uint,
      owner: principal,
      status: (string-ascii 20) }) ;; "active", "used", "cancelled"

(define-map event-counter uint uint)
