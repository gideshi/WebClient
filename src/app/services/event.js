angular.module("proton.event", ["proton.constants"])
	.service("eventManager", function (
		$interval, 
		$window, 
		$state, 
		$rootScope, 
		$stateParams, 
		authentication, 
		Contact, 
		CONSTANTS, 
		Events, 
		messageCache, 
		messageCounts,
		notify
	) {

		function getRandomInt(min, max) {
		    return Math.floor(Math.random() * (max - min + 1)) + min;
		}

		var DELETE = 0;
		var CREATE = 1;
		var UPDATE = 2;
		var UPDATE_FLAG = 3;
		var eventModel = {
			get: function() {
				return Events.get(this.ID);
			},
			isDifferent: function (eventID) {
				return this.ID !== eventID;
			},
			checkNotice: function() {
				return Events.getNoticies({}).then(function(response) {
					return response;
				});
			},
			manageLabels: function(labels) {
				if (angular.isDefined(labels)) {
					_.each(labels, function(label) {
						if(label.Action === DELETE) {
							authentication.user.Labels = _.filter(authentication.user.Labels, function(l) { return l.ID !== label.ID; });
							$rootScope.$broadcast('updateLabels');
						} else if(label.Action === CREATE) {
							authentication.user.Labels.push(label.Label);
						} else if(label.Action === UPDATE) {
							var index = _.findIndex(authentication.user.Labels, function(l) { return l.ID === label.Label.ID; });
							authentication.user.Labels[index] = _.extend(authentication.user.Labels[index], label.Label);
						}
					});
				}
			},
			manageContacts: function(contacts) {
				if (angular.isDefined(contacts)) {
					_.each(contacts, function(contact) {
						if(contact.Action === DELETE) {
							$rootScope.user.Contacts = _.filter($rootScope.user.Contacts, function(c) { return c.ID !== contact.ID; });
						} else if(contact.Action === CREATE) {
							$rootScope.user.Contacts.push(contact.Contact);
						} else if (contact.Action === UPDATE) {
							var index = _.findIndex($rootScope.user.Contacts, function(c) { return c.ID === contact.Contact.ID; });
							$rootScope.user.Contacts[index] = contact.Contact;
						}
						$rootScope.$broadcast('updateContacts');
						Contact.index.updateWith($rootScope.user.Contacts);
					});
				}
			},
			manageUser: function(user) {
				if(angular.isDefined(user)) {
					authentication.user = angular.merge(authentication.user, user);
				}
			},
			manageCounter: function(json) {
				if(angular.isDefined(json)) {
					var counters = {Labels:{}, Locations:{}, Starred: json.Starred};

					if (messageCounts.unreadChangedLocally) {
						messageCounts.unreadChangedLocally = false;
					} else {
			            _.each(json.Labels, function(obj) { counters.Labels[obj.LabelID] = obj.Count; });
			            _.each(json.Locations, function(obj) { counters.Locations[obj.Location] = obj.Count; });
                    	messageCounts.update(counters);
					}
				}
			},
			manageTotals: function(totals) {
				if(angular.isDefined(totals)) {
					var total = {Labels:{}, Locations:{}, Starred: totals.Starred};

					if (messageCounts.totalChangedLocally) {
						messageCounts.totalChangedLocally = false;
					} else {
						_.each(totals.Labels, function(obj) { total.Labels[obj.LabelID] = obj.Count; });
						_.each(totals.Locations, function(obj) { total.Locations[obj.Location] = obj.Count; });
						$rootScope.messageTotals = total;
					}
				}
			},
			manageMessages: function(messages) {
				if (angular.isDefined(messages)) {
					messageCache.set(messages);
				}
			},
			manageStorage: function(storage) {
				if(angular.isDefined(storage)) {
					authentication.user.UsedSpace = storage;
				}
			},
			manageID: function(id) {
				this.ID = id;
				window.sessionStorage[CONSTANTS.EVENT_ID] = id;
			},
			manage: function (data) {
				// Check if eventID is sent
				if (data.Error) {
					Events.getLatestID({}).then(function(response) {
						eventModel.manageID(response.data.EventID);
					});
				} else if (data.Refresh === 1) {
					messageCache.reset();
					eventModel.manageID(data.EventID);
				} else if (data.Reload === 1) {
					$window.location.reload();
				} else if (this.isDifferent(data.EventID)) {
					this.manageLabels(data.Labels);
					this.manageContacts(data.Contacts);
					this.manageUser(data.User);
					this.manageCounter(data.Unread);
 					this.manageTotals(data.Total);
					this.manageMessages(data.Messages);
					this.manageStorage(data.UsedSpace);
					this.manageID(data.EventID);
				}
				messageCache.manageExpire();
			}
		};
		var started = false;
		var api = _.bindAll({
				start: function () {
					if (!started) {
						eventModel.ID = window.sessionStorage[CONSTANTS.EVENT_ID];
						interval = function() {
							eventModel.get().then(function (result) {
								eventModel.manage(result.data);
							});
						};
						notice = function() {
							eventModel.checkNotice().then( function(result) {
								if (result.data.Notices!=='') {
									notify({
										message: result.data.Notices
									});
								}
							});
						};
						interval();
						notice();
						eventModel.promiseCancel = $interval(interval, CONSTANTS.INTERVAL_EVENT_TIMER);
						started = true;
						$interval(notice, getRandomInt(30000,40000));
					}
				},
				stop: function () {
					messageCache.empty();
					if (angular.isDefinded(eventModel.promiseCancel)) {
						$interval.cancel(eventModel.promiseCancel);
					}
				}

		});

		return api;
	});
