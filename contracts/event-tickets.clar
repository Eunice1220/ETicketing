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

;; Private Functions
(define-private (is-owner)
    (is-eq tx-sender contract-owner))

(define-private (get-event-count)
    (default-to u0 (map-get? event-counter u0)))

(define-private (increment-event-count)
    (let ((current-count (get-event-count)))
        (map-set event-counter u0 (+ current-count u1))
        (+ current-count u1)))

;; Public Functions
(define-public (create-event (name (string-ascii 100))
                           (description (string-ascii 500))
                           (venue (string-ascii 100))
                           (date uint)
                           (price uint)
                           (total-supply uint))
    (let ((event-id (increment-event-count)))
        (map-set events event-id
            { name: name,
              description: description,
              venue: venue,
              date: date,
              price: price,
              total-supply: total-supply,
              tickets-sold: u0,
              organizer: tx-sender })
        (ok event-id)))

(define-public (purchase-ticket (event-id uint))
    (let ((event (unwrap! (map-get? events event-id) err-not-found))
          (ticket-id (+ (get-event-count) (default-to u0 (get tickets-sold event-id)))))
        (asserts! (<= (+ (get tickets-sold event) u1) (get total-supply event)) err-sold-out)
        (try! (stx-transfer? (get price event) tx-sender (get organizer event)))
        (try! (nft-mint? event-ticket ticket-id tx-sender))
        (map-set tickets ticket-id
            { event-id: event-id,
              owner: tx-sender,
              status: "active" })
        (map-set events event-id
            (merge event { tickets-sold: (+ (get tickets-sold event) u1) }))
        (ok ticket-id)))


(define-public (transfer-ticket (ticket-id uint) (recipient principal))
    (let ((ticket (unwrap! (map-get? tickets ticket-id) err-not-found))
          (event (unwrap! (map-get? events (get event-id ticket)) err-not-found)))
        (asserts! (is-eq (get owner ticket) tx-sender) err-unauthorized)
        (asserts! (is-eq (get status ticket) "active") err-unauthorized)
        ;; Calculate and pay royalty
        (try! (stx-transfer?
            (/ (* (get price event) (var-get royalty-percentage)) u100)
            tx-sender
            (get organizer event)))
        ;; Transfer NFT
        (try! (nft-transfer? event-ticket ticket-id tx-sender recipient))
        ;; Update ticket ownership
        (map-set tickets ticket-id
            (merge ticket { owner: recipient }))
        (ok true)))

(define-public (use-ticket (ticket-id uint))
    (let ((ticket (unwrap! (map-get? tickets ticket-id) err-not-found)))
        (asserts! (is-eq (get owner ticket) tx-sender) err-unauthorized)
        (asserts! (is-eq (get status ticket) "active") err-unauthorized)
        (map-set tickets ticket-id
            (merge ticket { status: "used" }))
        (ok true)))

;; Read-Only Functions
(define-read-only (get-event (event-id uint))
    (map-get? events event-id))

(define-read-only (get-ticket (ticket-id uint))
    (map-get? tickets ticket-id))

(define-read-only (get-ticket-owner (ticket-id uint))
    (get owner (unwrap! (map-get? tickets ticket-id) err-not-found)))

(define-read-only (get-tickets-sold (event-id uint))
    (get tickets-sold (unwrap! (map-get? events event-id) err-not-found)))

;; Administrative Functions
(define-public (set-royalty-percentage (new-percentage uint))
    (begin
        (asserts! (is-owner) err-owner-only)
        (var-set royalty-percentage new-percentage)
        (ok true)))

