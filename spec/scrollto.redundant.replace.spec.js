/*global describe, it */
(function () {
    "use strict";

    describe( 'scrollTo(): Redundant calls, in "replace" mode.', function () {

        /** @type {DOMFixture}  populated by Setup.create() */
        var f,

            /** @type {jQuery} */
            $window,

            /** @type {Object}  holds animation callback functions of all types; functions are created with getCallbackLogger */
            callbacks,

            /** @type {Object}  collects info about callback calls, populated by functions which are created with getCallbackLogger */
            callbackCalls;

        beforeEach( function ( done ) {
            var fixtureCss = [
                "body { width: 3000px; height: 3000px; }",
                "html, body { margin: 0; padding: 0; border: none; }"
            ];

            f = Setup.create( "window", f, { createEl: false, injectCss: fixtureCss } );

            $window = $( window );

            $window.scrollTop( 0 ).scrollLeft( 0 );

            // Reduce the default duration for animations in order to speed up the tests
            reduceDefaultDurationForAnimations();

            // Set a very low threshold for $.scrollable.lockSpeedBelow to keep the speed lock from kicking in. See
            // setLowMinimumSpeed() for more.
            //
            // ATTN To make it work, scroll movements during tests must be larger than 20px (by a fair margin, ideally).
            setLowMinimumSpeed();

            // Create observed callbacks
            callbackCalls = {};
            callbacks = createObservedCallbacks( callbackCalls, $window );

            // Give browsers some breathing space to complete the initial setup phase.
            _.delay( done, 50 );
        } );

        afterEach( function () {
            f.cleanDom();
            restoreDefaultDurationForAnimations();
            restoreMinimumSpeed();
        } );

        afterAll( function () {
            $window.scrollTop( 0 ).scrollLeft( 0 );
            f.shutdown();
        } );

        describe( 'At rest, without ongoing scroll movements. Current and target locations are identical.', function () {

            var initialX, initialY;

            beforeEach( function ( done ) {
                initialX = initialY = 50;
                $window.scrollTop( initialY ).scrollLeft( initialX );

                // Add a delay. In iOS, the position is *not* reached instantly, needs a timeout
                afterScreenUpdate( done );
            } );

            describe( 'Movement. The animation is skipped', function () {

                // Test method:
                //
                // We test this by appending another animation. It should start immediately. When the time needed for a
                // single scroll animation has passed, the target of the appended animation must already have been
                // reached.

                it( 'for a horizontal movement', function ( done ) {
                    $window
                        .scrollTo( { x: initialX } )
                        .scrollTo( { x: initialX + 100 }, { append: true } );

                    afterScroll( function () {
                        expect( $window.scrollTop() ).toEqual( initialY );
                        expect( $window.scrollLeft() ).toFuzzyEqual( initialX + 100 );
                        done();
                    } );
                } );

                it( 'for a vertical movement', function ( done ) {
                    $window
                        .scrollTo( { y: initialY } )
                        .scrollTo( { y: initialY + 100 }, { append: true } );

                    afterScroll( function () {
                        expect( $window.scrollTop() ).toFuzzyEqual( initialY + 100 );
                        expect( $window.scrollLeft() ).toEqual( initialX );
                        done();
                    } );
                } );

                it( 'for a movement on both axes', function ( done ) {
                    $window
                        .scrollTo( { x: initialX, y: initialY } )
                        .scrollTo( { x: initialX + 100, y: initialY + 100 }, { append: true } );

                    afterScroll( function () {
                        expect( $window.scrollTop() ).toFuzzyEqual( initialY + 100 );
                        expect( $window.scrollLeft() ).toFuzzyEqual( initialX + 100 );
                        done();
                    } );
                } );

            } );

            describe( 'Callbacks.', function () {

                beforeEach( function ( done ) {
                    $window.scrollTop( 50 ).scrollLeft( 50 );
                    $window.scrollTo( 50, callbacks );
                    afterScroll( done );
                } );

                it( 'The "start" callback has not fired', function () {
                    expect( callbacks.start ).not.toHaveBeenCalled();
                } );

                it( 'The "step" callback has not fired', function () {
                    expect( callbacks.step ).not.toHaveBeenCalled();
                } );

                it( 'The "progress" callback has not fired', function () {
                    expect( callbacks.progress ).not.toHaveBeenCalled();
                } );

                it( 'The "done" callback has not fired', function () {
                    expect( callbacks.done ).not.toHaveBeenCalled();
                } );

                it( 'The "complete" callback has not fired', function () {
                    expect( callbacks.complete ).not.toHaveBeenCalled();
                } );

                it( 'The "fail" callback has not fired', function () {
                    expect( callbacks.fail ).not.toHaveBeenCalled();
                } );

                it( 'The "always" callback has not fired', function () {
                    expect( callbacks.always ).not.toHaveBeenCalled();
                } );

            } );

        } );

        describe( 'A scroll movement is in progress. Its target location and the target of the new call are the same.', function () {

            // We are in replace mode, so ongoing animations are always halted and replaced.

            it( 'A new scrollTo animation starts, regardless', function ( done ) {
                // First scroll movement.
                $window.scrollTo( 100 );

                // Because the animation will be restarted in mid movement, after one scroll period the target hasn't
                // yet been reached.
                afterScroll( function () {
                    expect( $window.scrollTop() ).toBeLessThan( 100 );
                } );

                inMidScroll( function () {
                    $window.scrollTo( 100 );

                    // One scroll period after the restart, the target is reached.
                    afterScroll( function () {
                        expect( $window.scrollTop() ).toFuzzyEqual( 100 );
                        done();
                    } );
                } );
            } );

            it( 'Callbacks of the new scrollTo call all fire as usual', function ( done ) {
                // First scroll movement.
                $window.scrollTo( 100 );

                inMidScroll( function () {
                    $window.scrollTo( 100, callbacks );

                    afterScroll( function () {
                        expect( callbacks.start ).toHaveBeenCalled();
                        expect( callbacks.step ).toHaveBeenCalled();
                        expect( callbacks.progress ).toHaveBeenCalled();
                        expect( callbacks.done ).toHaveBeenCalled();
                        expect( callbacks.complete ).toHaveBeenCalled();
                        expect( callbacks.always ).toHaveBeenCalled();
                        expect( callbacks.fail ).not.toHaveBeenCalled();

                        expect( callbackCalls.complete.args[0] ).toEqual( {} );
                        expect( callbackCalls.done.args[2] ).toEqual( {} );
                        expect( callbackCalls.always.args[2] ).toEqual( {} );

                        done();
                    } );
                } );
            } );

            it( 'The "fail" and "always" callbacks of the initial scroll animation fire, and are called with a cancelled: "replace" message', function ( done ) {
                // First scroll movement.
                $window.scrollTo( 100, callbacks );

                inMidScroll( function () {
                    $window.scrollTo( 100 );

                    afterScroll( function () {
                        expect( callbacks.done ).not.toHaveBeenCalled();
                        expect( callbacks.complete ).not.toHaveBeenCalled();

                        expect( callbacks.always ).toHaveBeenCalled();
                        expect( callbacks.fail ).toHaveBeenCalled();

                        expect( callbackCalls.fail.args[2] ).toEqual( { cancelled: "replace" } );
                        expect( callbackCalls.always.args[2] ).toEqual( { cancelled: "replace" } );

                        done();
                    } );
                } );
            } );

        } );

        describe( 'A scroll movement is in progress, and and another scroll animation is waiting in the queue. Their eventual target location and the target of the new call are the same.', function () {

            // We are in replace mode, so ongoing animations are always halted and replaced.

            it( 'A new scrollTo animation starts, regardless', function ( done ) {
                // First and second scroll movement.
                $window.scrollTo( 50 ).scrollTo( 100, { append: true } );

                // Because the animation will be restarted in mid movement, after two scroll periods the target hasn't
                // yet been reached.
                afterScrolls( 2, function () {
                    expect( $window.scrollTop() ).toBeLessThan( 100 );
                } );

                inMidScroll( function () {
                    $window.scrollTo( 100 );

                    // One scroll period after the restart, the target is reached.
                    afterScroll( function () {
                        expect( $window.scrollTop() ).toFuzzyEqual( 100 );
                        done();
                    } );
                } );
            } );

            it( 'Callbacks of the new scrollTo call all fire as usual', function ( done ) {
                // First and second scroll movement.
                $window.scrollTo( 50 ).scrollTo( 100, { append: true } );

                inMidScroll( function () {
                    $window.scrollTo( 100, callbacks );

                    afterScroll( function () {
                        expect( callbacks.start ).toHaveBeenCalled();
                        expect( callbacks.step ).toHaveBeenCalled();
                        expect( callbacks.progress ).toHaveBeenCalled();
                        expect( callbacks.done ).toHaveBeenCalled();
                        expect( callbacks.complete ).toHaveBeenCalled();
                        expect( callbacks.always ).toHaveBeenCalled();
                        expect( callbacks.fail ).not.toHaveBeenCalled();

                        expect( callbackCalls.complete.args[0] ).toEqual( {} );
                        expect( callbackCalls.done.args[2] ).toEqual( {} );
                        expect( callbackCalls.always.args[2] ).toEqual( {} );

                        done();
                    } );
                } );
            } );

            it( 'The "fail" and "always" callbacks of the initial scroll animation fire, and are called with a cancelled: "replace" message', function ( done ) {
                // First and second scroll movement.
                $window
                    .scrollTo( 50, callbacks )
                    .scrollTo( 100, { append: true } );

                inMidScroll( function () {
                    $window.scrollTo( 100 );

                    afterScroll( function () {
                        expect( callbacks.done ).not.toHaveBeenCalled();
                        expect( callbacks.complete ).not.toHaveBeenCalled();

                        expect( callbacks.always ).toHaveBeenCalled();
                        expect( callbacks.fail ).toHaveBeenCalled();

                        expect( callbackCalls.fail.args[2] ).toEqual( { cancelled: "replace" } );
                        expect( callbackCalls.always.args[2] ).toEqual( { cancelled: "replace" } );

                        done();
                    } );
                } );
            } );

            it( 'The callbacks of the second, queued scroll animation do not fire', function ( done ) {
                // First and second scroll movement.
                $window
                    .scrollTo( 50 )
                    .scrollTo( 100, $.extend( { append: true }, callbacks ) );

                inMidScroll( function () {
                    $window.scrollTo( 100 );

                    afterScroll( function () {
                        expect( callbacks.start ).not.toHaveBeenCalled();
                        expect( callbacks.step ).not.toHaveBeenCalled();
                        expect( callbacks.progress ).not.toHaveBeenCalled();
                        expect( callbacks.done ).not.toHaveBeenCalled();
                        expect( callbacks.complete ).not.toHaveBeenCalled();
                        expect( callbacks.always ).not.toHaveBeenCalled();
                        expect( callbacks.fail ).not.toHaveBeenCalled();

                        done();
                    } );
                } );
            } );

        } );

    } );

})();